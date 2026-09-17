import { pool } from '../../config/db.js';
import { aiConfig } from '../../config/ai.js';
import { listModels } from './ollama.js';

/**
 * 智能体设置：存在 system_settings 键值表里，管理员可在后台调整；
 * 未设置时回落到环境变量或第一可用模型。
 */

export const SETTING_KEYS = {
  defaultModel: 'ai.default_model',
  enabledScenes: 'ai.enabled_scenes',
  studentGreeting: 'ai.student_greeting',
  adminGreeting: 'ai.admin_greeting',
  voiceEnabled: 'ai.voice_enabled',
  voiceAutoSpeak: 'ai.voice_auto_speak',
  maxToolRounds: 'ai.max_tool_rounds',
  numCtx: 'ai.num_ctx'
};

export async function readSettings() {
  const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
  const stored = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));

  const parseList = (value, fallback) => {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return String(value).split(',').map((item) => item.trim()).filter(Boolean);
    }
  };

  const parseBool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return value === 'true' || value === '1' || value === true;
  };

  return {
    defaultModel: stored[SETTING_KEYS.defaultModel] || aiConfig.defaultModel || '',
    enabledScenes: parseList(stored[SETTING_KEYS.enabledScenes], ['student', 'admin']),
    studentGreeting: stored[SETTING_KEYS.studentGreeting] || '',
    adminGreeting: stored[SETTING_KEYS.adminGreeting] || '',
    voiceEnabled: parseBool(stored[SETTING_KEYS.voiceEnabled], true),
    voiceAutoSpeak: parseBool(stored[SETTING_KEYS.voiceAutoSpeak], false),
    maxToolRounds: Number(stored[SETTING_KEYS.maxToolRounds]) || aiConfig.maxToolRounds,
    numCtx: Number(stored[SETTING_KEYS.numCtx]) || aiConfig.numCtx,
    ollamaHost: aiConfig.host,
    modelsDir: aiConfig.modelsDir,
    allowlist: aiConfig.allowlist
  };
}

export async function writeSettings(patch = {}) {
  const entries = [];
  const put = (key, value) => entries.push([key, value === undefined || value === null ? null : String(value)]);

  if (patch.defaultModel !== undefined) put(SETTING_KEYS.defaultModel, patch.defaultModel);
  if (patch.enabledScenes !== undefined) {
    put(SETTING_KEYS.enabledScenes, JSON.stringify(Array.isArray(patch.enabledScenes) ? patch.enabledScenes : []));
  }
  if (patch.studentGreeting !== undefined) put(SETTING_KEYS.studentGreeting, patch.studentGreeting);
  if (patch.adminGreeting !== undefined) put(SETTING_KEYS.adminGreeting, patch.adminGreeting);
  if (patch.voiceEnabled !== undefined) put(SETTING_KEYS.voiceEnabled, patch.voiceEnabled ? 'true' : 'false');
  if (patch.voiceAutoSpeak !== undefined) put(SETTING_KEYS.voiceAutoSpeak, patch.voiceAutoSpeak ? 'true' : 'false');
  if (patch.maxToolRounds !== undefined) put(SETTING_KEYS.maxToolRounds, patch.maxToolRounds);
  if (patch.numCtx !== undefined) put(SETTING_KEYS.numCtx, patch.numCtx);

  for (const [key, value] of entries) {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    );
  }
  return readSettings();
}

/**
 * 「14.8B」/「494.03M」/「7b」→ 以 B 为单位的参数量；解析不出按 0（最小）处理。
 */
function parseParamCount(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)\s*([BMK])/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'B') return value;
  if (unit === 'M') return value / 1000;
  return value / 1_000_000;
}

/**
 * 未显式配置默认模型时，从可用模型里挑一个「能干活」的。
 *
 * 不能拿 models[0]：`/api/tags` 是按名称排序的，本机第一个恰好是 qwen2.5:0.5b。
 * 0.5B 的模型不会真的发起工具调用（虽然聊天模板里有 tools 段，supportsTools 会误判
 * 成 true），它会凭记忆编一个答案 —— 正好踩中本平台最不能接受的「编造题目和分数」。
 *
 * 这里用参数量作为能力代理：参数越大越能稳定遵循工具调用格式。参数量相同再比体积，
 * 最后按名称排序，保证同一批模型每次选出同一个结果。
 */
export function pickRecommendedModel(models = []) {
  if (!models.length) return '';
  const sorted = [...models].sort((a, b) => {
    const diff = parseParamCount(b.parameterSize) - parseParamCount(a.parameterSize);
    if (diff) return diff;
    const sizeDiff = Number(b.size || 0) - Number(a.size || 0);
    if (sizeDiff) return sizeDiff;
    return String(a.name).localeCompare(String(b.name));
  });
  return sorted[0].name;
}

/**
 * 对外暴露的「当前默认模型」：后台设置优先，未设置时给推荐值而不是空串，
 * 免得前端各自回落到 models[0]。不抛异常 —— Ollama 不可用时元数据接口仍要能返回。
 */
export async function resolveDefaultModel() {
  const settings = await readSettings();
  if (settings.defaultModel) return settings.defaultModel;
  try {
    return pickRecommendedModel(await listModels());
  } catch {
    return '';
  }
}

/** 解析本次对话实际使用的模型：请求指定 > 后台设置 > 环境变量 > 推荐模型。 */
export async function resolveModel(requested) {
  const requestedName = String(requested || '').trim();
  if (requestedName) return requestedName;

  const settings = await readSettings();
  if (settings.defaultModel) return settings.defaultModel;

  const models = await listModels();
  if (!models.length) {
    throw Object.assign(new Error('本机 Ollama 没有可用模型，请先 ollama pull 一个模型'), { status: 503 });
  }
  return pickRecommendedModel(models);
}
