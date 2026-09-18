import { Router } from 'express';
import { pool } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { allow, isStaff } from '../middleware/role.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage } from '../utils/paginate.js';
import { logger } from '../utils/logger.js';
import { aiConfig } from '../config/ai.js';
import { listModels, runningModels, loadModel, unloadModel, health, invalidateModelCache } from '../services/ai/ollama.js';
import { runAgent, SCENES, LANGUAGES, sceneMeta } from '../services/ai/agent.js';
import { readSettings, resolveModel, resolveDefaultModel, pickRecommendedModel } from '../services/ai/settings.js';

const router = Router();

const HEARTBEAT_MS = 15_000;

function safeLang(value) {
  return LANGUAGES.includes(value) ? value : 'zh-CN';
}

/** 管理端场景需要后台角色（超管或内容管理员），学员场景任何登录用户都可用。 */
function resolveScene(requested, user) {
  const scene = SCENES[requested] ? requested : 'student';
  if (scene === 'admin' && !isStaff(user.role)) {
    throw new HttpError(403, 'Admin scene requires a staff account');
  }
  return scene;
}

// ---------------------------------------------------------------- 模型

router.get(
  '/health',
  auth(),
  asyncHandler(async (_req, res) => {
    ok(res, {
      enabled: aiConfig.enabled,
      // 非空表示当前跑在测试模型上（仅非生产环境可能非空），前端据此显示醒目徽标
      testModel: aiConfig.testModel || null,
      maxModelSizeGb: aiConfig.maxModelSizeGb,
      modelsDir: aiConfig.modelsDir,
      ...(await health())
    });
  })
);

router.get(
  '/models',
  auth(),
  asyncHandler(async (req, res) => {
    const [models, running, settings] = await Promise.all([
      listModels({ refresh: req.query.refresh === 'true' }),
      runningModels(),
      readSettings()
    ]);
    const loaded = new Set(running.map((item) => item.name));
    ok(res, {
      // 每个模型都带 selectable / excludedReason，前端据此渲染禁用项与原因
      models: models.map((model) => ({ ...model, loaded: loaded.has(model.name) })),
      running,
      // 优先级与 settings.js 的 resolveDefaultModel() 保持一致：
      // 测试开关 > 后台设置 > 推荐模型。都不做时前端会各自拿 list[0]，
      // 而 list[0] 恰好是 0.5B 的小模型。
      defaultModel: aiConfig.testModel || settings.defaultModel || pickRecommendedModel(models),
      maxModelSizeGb: aiConfig.maxModelSizeGb,
      testModel: aiConfig.testModel || null,
      host: aiConfig.host,
      keepAlive: aiConfig.keepAlive
    });
  })
);

router.post(
  '/models/load',
  auth(),
  rateLimit({ keyPrefix: 'ai-load', windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const model = String(req.body?.model || '').trim();
    if (!model) throw new HttpError(400, 'model is required');
    const result = await loadModel(model);
    ok(res, result, 'loaded');
  })
);

router.post(
  '/models/unload',
  auth(),
  asyncHandler(async (req, res) => {
    const model = String(req.body?.model || '').trim();
    if (!model) throw new HttpError(400, 'model is required');
    ok(res, await unloadModel(model), 'unloaded');
  })
);

// ---------------------------------------------------------------- 智能体元信息

router.get(
  '/agent',
  auth(),
  asyncHandler(async (req, res) => {
    const scene = resolveScene(req.query.scene, req.user);
    const lang = safeLang(req.query.lang);
    const settings = await readSettings();
    const meta = sceneMeta(scene, lang);

    // 后台自定义欢迎语优先
    const greetingOverride = scene === 'admin' ? settings.adminGreeting : settings.studentGreeting;
    if (greetingOverride) meta.greeting = greetingOverride;

    ok(res, {
      ...meta,
      scene,
      lang,
      languages: LANGUAGES,
      enabled: aiConfig.enabled,
      voice: {
        enabled: settings.voiceEnabled,
        autoSpeak: settings.voiceAutoSpeak,
        sttLanguages: LANGUAGES,
        ttsLanguages: LANGUAGES
      },
      defaultModel: await resolveDefaultModel(),
      // 测试模型只在非生产生效。下发它是为了让弹框顶部常驻一条警示 ——
      // 徽标如果只藏在「模型」面板里，一路聊下去的人根本看不到。
      testModel: aiConfig.testModel
    });
  })
);

// ---------------------------------------------------------------- 会话

router.get(
  '/sessions',
  auth(),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    if (isStaff(req.user.role) && req.query.all === 'true') {
      if (req.query.userId) {
        conditions.push('s.user_id = ?');
        params.push(Number(req.query.userId));
      }
    } else {
      conditions.push('s.user_id = ?');
      params.push(req.user.id);
    }
    if (req.query.scene) {
      conditions.push('s.scene = ?');
      params.push(String(req.query.scene));
    }

    const data = await queryPage({
      columns: 's.id, s.user_id, s.scene, s.title, s.model, s.message_count, s.created_at, s.updated_at, u.username',
      from: 'FROM ai_sessions s JOIN users u ON u.id = s.user_id',
      conditions,
      params,
      orderBy: 's.updated_at DESC, s.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

/** 校验会话归属：普通用户只能看自己的，后台角色可以看全部。 */
async function assertSessionAccess(sessionId, user) {
  const [[session]] = await pool.execute('SELECT id, user_id, scene, model, title FROM ai_sessions WHERE id = ?', [sessionId]);
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.user_id !== user.id && !isStaff(user.role)) throw new HttpError(403, 'Forbidden');
  return session;
}

router.get(
  '/sessions/:id/messages',
  auth(),
  asyncHandler(async (req, res) => {
    await assertSessionAccess(Number(req.params.id), req.user);
    const { page, pageSize } = pageParams(req.query, { defaultSize: 50 });
    const data = await queryPage({
      columns: 'id, role, content, tool_name, tool_args, model, latency_ms, created_at',
      from: 'FROM ai_messages',
      conditions: ['session_id = ?', "role <> 'system'"],
      params: [Number(req.params.id)],
      orderBy: 'id ASC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.delete(
  '/sessions/:id',
  auth(),
  asyncHandler(async (req, res) => {
    await assertSessionAccess(Number(req.params.id), req.user);
    await pool.execute('DELETE FROM ai_sessions WHERE id = ?', [Number(req.params.id)]);
    ok(res, null, 'deleted');
  })
);

router.get(
  '/logs',
  auth(),
  allow('admin'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    if (req.query.model) {
      conditions.push('l.model = ?');
      params.push(String(req.query.model));
    }
    if (req.query.scene) {
      conditions.push('l.scene = ?');
      params.push(String(req.query.scene));
    }
    if (req.query.status) {
      conditions.push('l.status = ?');
      params.push(String(req.query.status));
    }

    const data = await queryPage({
      columns: `l.id, l.user_id, l.session_id, l.scene, l.model, l.tool_names, l.prompt_chars,
                l.completion_chars, l.latency_ms, l.status, l.error, l.created_at, u.username`,
      from: 'FROM ai_call_logs l LEFT JOIN users u ON u.id = l.user_id',
      conditions,
      params,
      orderBy: 'l.created_at DESC, l.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

// ---------------------------------------------------------------- 对话（SSE）

/**
 * SSE 流式对话。
 *
 * 不能用 asyncHandler：响应头发出后中间件无法再改写状态码，需要自行处理错误。
 * 事件负载统一放在 `data:` 里，用 JSON 的 `type` 字段区分。
 */
async function chatHandler(req, res) {
  const { message, sessionId, model: requestedModel } = req.body || {};
  const text = String(message || '').trim();
  const lang = safeLang(req.body?.lang);

  if (!text) return res.status(400).json({ code: 400, message: 'message is required' });
  if (text.length > 4000) return res.status(400).json({ code: 400, message: 'message is too long (max 4000 chars)' });
  if (!aiConfig.enabled) return res.status(503).json({ code: 503, message: 'AI is disabled (AI_ENABLED=false)' });

  let scene;
  let model;
  let session;

  // 以下任何一步失败都发生在 SSE 响应头之前，可以直接返回 JSON 错误
  try {
    scene = resolveScene(req.body?.scene, req.user);
    model = await resolveModel(requestedModel);

    if (sessionId) {
      session = await assertSessionAccess(Number(sessionId), req.user);
    } else {
      const title = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      const [created] = await pool.execute(
        'INSERT INTO ai_sessions (user_id, scene, title, model) VALUES (?, ?, ?, ?)',
        [req.user.id, scene, title, model]
      );
      session = { id: created.insertId, user_id: req.user.id, scene };
    }
  } catch (error) {
    return res.status(error.status || 500).json({ code: error.status || 500, message: error.message });
  }

  // 历史：取最近若干轮，新会话为空。
  // LIMIT 必须内联：mysql2 的预处理语句不支持 LIMIT 占位符，会抛 ER_WRONG_ARGUMENTS。
  const historyLimit = Math.max(1, Math.min(aiConfig.historyTurns * 2, 200));
  const [historyRows] = await pool.execute(
    `SELECT role, content FROM ai_messages
     WHERE session_id = ? AND role IN ('user','assistant') AND content IS NOT NULL AND content <> ''
     ORDER BY id DESC LIMIT ${historyLimit}`,
    [session.id]
  );
  const history = historyRows.reverse();

  await pool.execute('INSERT INTO ai_messages (session_id, role, content, model) VALUES (?, ?, ?, ?)', [
    session.id,
    'user',
    text,
    model
  ]);

  // ---- 建立 SSE 通道 ----
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (payload) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, HEARTBEAT_MS);

  const controller = new AbortController();
  const onClose = () => controller.abort();
  req.on('close', onClose);

  const startedAt = Date.now();
  let answer = '';
  let usedTools = [];

  try {
    for await (const event of runAgent({
      scene,
      user: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.username },
      lang,
      model,
      history,
      message: text,
      signal: controller.signal
    })) {
      if (event.type === 'meta') {
        send({ ...event, sessionId: session.id, lang });
      } else if (event.type === 'delta') {
        answer += event.text;
        send(event);
      } else if (event.type === 'done') {
        usedTools = event.tools || [];
        send({ ...event, sessionId: session.id });
      } else {
        send(event);
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      logger.error('Agent run failed', { model, scene, message: error.message });
      send({ type: 'error', message: error.message || 'agent failed' });
      await pool
        .execute(
          `INSERT INTO ai_call_logs (user_id, session_id, scene, model, tool_names, prompt_chars,
                                     completion_chars, latency_ms, status, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'error', ?)`,
          [req.user.id, session.id, scene, model, usedTools.join(','), text.length, answer.length,
            Date.now() - startedAt, String(error.message).slice(0, 500)]
        )
        .catch(() => {});
    }
  } finally {
    clearInterval(heartbeat);
    req.off('close', onClose);

    // 落库：助手回复 + 会话计数 + 调用日志
    if (answer) {
      await pool
        .execute('INSERT INTO ai_messages (session_id, role, content, model, latency_ms) VALUES (?, ?, ?, ?, ?)', [
          session.id, 'assistant', answer, model, Date.now() - startedAt
        ])
        .catch((error) => logger.warn('Failed to persist assistant message', { message: error.message }));
    }
    await pool
      .execute('UPDATE ai_sessions SET message_count = message_count + ?, model = ?, updated_at = NOW() WHERE id = ?', [
        answer ? 2 : 1,
        model,
        session.id
      ])
      .catch(() => {});
    await pool
      .execute(
        `INSERT INTO ai_call_logs (user_id, session_id, scene, model, tool_names, prompt_chars,
                                   completion_chars, latency_ms, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, session.id, scene, model, usedTools.join(','), text.length, answer.length,
          Date.now() - startedAt, controller.signal.aborted ? 'error' : 'ok']
      )
      .catch(() => {});

    if (!res.writableEnded) res.end();
  }
}

router.post(
  '/chat',
  auth(),
  rateLimit({ keyPrefix: 'ai-chat', windowMs: 60_000, max: 30, keyBy: (req) => String(req.user?.id || req.ip) }),
  // Express 4 不会捕获 async 处理器抛出的异常：显式 catch 交给全局错误处理，
  // 否则一个坏请求会变成 unhandledRejection 把整个进程打挂。
  (req, res, next) => chatHandler(req, res).catch(next)
);

export default router;
