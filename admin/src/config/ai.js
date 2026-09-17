import path from 'node:path';

/**
 * 把各种写法的 OLLAMA_HOST 归一化成可用的客户端基址。
 *
 * 本机 Ollama 的 systemd 配置是 `OLLAMA_HOST=0.0.0.0:11434`（用于对外监听），
 * 这个地址不能直接当客户端地址用，需要换回回环地址。
 */
export function normalizeOllamaHost(raw) {
  let value = String(raw || '').trim();
  if (!value) return 'http://127.0.0.1:11434';

  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;

  let url;
  try {
    url = new URL(value);
  } catch {
    return 'http://127.0.0.1:11434';
  }

  if (url.hostname === '0.0.0.0' || url.hostname === '::' || url.hostname === '[::]') {
    url.hostname = '127.0.0.1';
  }
  if (!url.port) url.port = '11434';

  return url.origin;
}

const num = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const aiConfig = {
  enabled: process.env.AI_ENABLED !== 'false',
  host: normalizeOllamaHost(process.env.OLLAMA_HOST),
  /** API 不可用时回落到直接扫描 manifests 目录 */
  modelsDir: process.env.OLLAMA_MODELS || '/usr/share/ollama/.ollama/models',
  /** 显式白名单，逗号分隔；为空表示放行 API 返回的全部模型 */
  allowlist: String(process.env.AI_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  defaultModel: process.env.AI_DEFAULT_MODEL || '',
  keepAlive: process.env.AI_KEEP_ALIVE || '10m',
  maxToolRounds: num(process.env.AI_MAX_TOOL_ROUNDS, 4),
  /** 显式设置上下文窗口，避免 Ollama 默认值过小截断系统提示词 */
  numCtx: num(process.env.AI_NUM_CTX, 16384),
  timeoutMs: num(process.env.AI_TIMEOUT_MS, 120_000),
  /** 单条工具结果注入模型前的最大字符数 */
  toolResultChars: num(process.env.AI_TOOL_RESULT_CHARS, 4000),
  /** 回传模型的历史轮数上限 */
  historyTurns: num(process.env.AI_HISTORY_TURNS, 12)
};

export const aiModelsDir = path.resolve(aiConfig.modelsDir);
