import { Router } from 'express';
import { pool } from '../config/db.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage, likeValue } from '../utils/paginate.js';
import { aiConfig } from '../config/ai.js';
import { listModels, runningModels, invalidateModelCache } from '../services/ai/ollama.js';
import { readSettings, writeSettings, SETTING_KEYS, pickRecommendedModel } from '../services/ai/settings.js';
import { SCENES } from '../services/ai/agent.js';

/** 后台「智能体」菜单：设置 / 会话 / 调用日志。 */

const router = Router();

const SCENE_IDS = Object.keys(SCENES);

// ---------------------------------------------------------------- 设置

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const [settings, models, running] = await Promise.all([readSettings(), listModels(), runningModels()]);
    ok(res, {
      ...settings,
      // 未配置时回落到推荐模型：这里回空串会让设置页的下拉框选不中任何一项，显示成空白
      defaultModel: settings.defaultModel || pickRecommendedModel(models),
      scenes: SCENE_IDS.map((id) => ({ id, name: SCENES[id].name })),
      availableModels: models.map((model) => ({ name: model.name, size: model.size, loaded: running.some((r) => r.name === model.name) })),
      env: {
        enabled: aiConfig.enabled,
        host: aiConfig.host,
        keepAlive: aiConfig.keepAlive,
        maxToolRounds: aiConfig.maxToolRounds,
        numCtx: aiConfig.numCtx,
        timeoutMs: aiConfig.timeoutMs
      },
      settingKeys: SETTING_KEYS
    });
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    if (body.enabledScenes !== undefined) {
      if (!Array.isArray(body.enabledScenes)) throw new HttpError(400, 'enabledScenes 必须是数组');
      const unknown = body.enabledScenes.filter((id) => !SCENE_IDS.includes(id));
      if (unknown.length) throw new HttpError(400, `未知场景：${unknown.join(', ')}`);
    }
    for (const [field, { min, max }] of Object.entries({ maxToolRounds: { min: 1, max: 10 }, numCtx: { min: 512, max: 131072 } })) {
      if (body[field] === undefined || body[field] === '') continue;
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new HttpError(400, `${field} 必须是 ${min}~${max} 之间的整数`);
      }
    }
    if (body.defaultModel) {
      const models = await listModels();
      if (models.length && !models.some((model) => model.name === body.defaultModel)) {
        throw new HttpError(400, `本机 Ollama 没有模型 ${body.defaultModel}`);
      }
    }

    ok(res, await writeSettings(body), 'updated');
  })
);

/** 手动触发刷新模型缓存（刚 `ollama pull` 完不想等 30s 缓存过期时用）。 */
router.post(
  '/settings/refresh-models',
  asyncHandler(async (_req, res) => {
    invalidateModelCache();
    ok(res, { models: await listModels({ refresh: true }) }, 'refreshed');
  })
);

// ---------------------------------------------------------------- 会话

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(s.title LIKE ? OR u.username LIKE ?)');
      params.push(keyword, keyword);
    }
    if (req.query.scene) {
      conditions.push('s.scene = ?');
      params.push(SCENE_IDS.includes(req.query.scene) ? req.query.scene : '__none__');
    }
    if (req.query.userId) {
      conditions.push('s.user_id = ?');
      params.push(Number(req.query.userId));
    }

    const data = await queryPage({
      columns: `s.id, s.user_id, s.scene, s.title, s.model, s.message_count, s.created_at, s.updated_at,
                u.username, u.name AS user_name`,
      from: 'FROM ai_sessions s LEFT JOIN users u ON u.id = s.user_id',
      conditions,
      params,
      orderBy: 's.updated_at DESC, s.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/sessions/:id/messages',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[session]] = await pool.execute('SELECT id FROM ai_sessions WHERE id = ?', [id]);
    if (!session) throw new HttpError(404, '会话不存在');

    const { page, pageSize } = pageParams(req.query, { defaultSize: 50 });
    const data = await queryPage({
      columns: 'id, role, content, tool_name, model, latency_ms, created_at',
      from: 'FROM ai_messages',
      conditions: ['session_id = ?', "role <> 'system'"],
      params: [id],
      orderBy: 'id ASC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.delete(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    // ai_messages 是 ON DELETE CASCADE，ai_call_logs 的 session_id 会 SET NULL
    const [result] = await pool.execute('DELETE FROM ai_sessions WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, '会话不存在');
    ok(res, null, 'deleted');
  })
);

// ---------------------------------------------------------------- 调用日志

router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(u.username LIKE ? OR l.error LIKE ?)');
      params.push(keyword, keyword);
    }
    if (req.query.model) {
      conditions.push('l.model = ?');
      params.push(String(req.query.model));
    }
    if (req.query.scene) {
      conditions.push('l.scene = ?');
      params.push(SCENE_IDS.includes(req.query.scene) ? req.query.scene : '__none__');
    }
    if (req.query.status) {
      conditions.push('l.status = ?');
      params.push(['ok', 'error'].includes(req.query.status) ? req.query.status : '__none__');
    }

    const data = await queryPage({
      columns: `l.id, l.user_id, l.session_id, l.scene, l.model, l.tool_names, l.prompt_chars,
                l.completion_chars, l.latency_ms, l.status, l.error, l.created_at,
                u.username, u.name AS user_name`,
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

export default router;
