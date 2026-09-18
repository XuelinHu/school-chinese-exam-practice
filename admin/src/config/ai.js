import fs from 'node:fs';
import os from 'node:os';
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

/**
 * 定位 Ollama 的模型仓库目录（`OLLAMA_MODELS`），供 `/api/tags` 不可达时回落扫描。
 *
 * 不能想当然写 `~/.ollama/models`：Ollama 以 systemd 服务运行时 home 是服务账号的，
 * 本机服务账号为 `ollama`，模型仓库已由 systemd 的 OLLAMA_MODELS 迁到 `/ds2/ollama-models`；
 * `/usr/share/ollama/.ollama/models` 是迁移前的位置，留作回退候选。
 * 因此按候选顺序取第一个真实存在的目录；都不存在时返回首选路径并置 `modelsDirFound=false`，
 * 由调用方决定是否告警。
 */
function resolveModelsDir(raw) {
  const explicit = String(raw || '').trim();
  if (explicit) return { dir: path.resolve(explicit), found: isDir(path.resolve(explicit)) };

  const candidates = [
    '/ds2/ollama-models',
    '/usr/share/ollama/.ollama/models',
    path.join(os.homedir(), '.ollama', 'models')
  ];
  for (const candidate of candidates) {
    if (isDir(candidate)) return { dir: candidate, found: true };
  }
  return { dir: candidates[0], found: false };
}

function isDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

const num = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const numFloat = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * 测试用模型开关：仅在非生产环境生效。
 *
 * 最小模型（本机 qwen2.5:0.5b）响应快，适合跑测试，但它的聊天模板同样含 tools 段，
 * `supportsTools()` 会误判为支持，实际却不会发起工具调用 —— 生产环境绝不能落到它身上。
 * 所以在生产环境显式忽略该变量并回报 `ignoredInProduction`，由启动横幅告警。
 */
function resolveTestModel(raw) {
  const name = String(raw || '').trim();
  if (!name) return { model: '', ignoredInProduction: false };
  if (process.env.NODE_ENV === 'production') return { model: '', ignoredInProduction: true };
  return { model: name, ignoredInProduction: false };
}

const modelsDirInfo = resolveModelsDir(process.env.OLLAMA_MODELS);
const testModelInfo = resolveTestModel(process.env.AI_TEST_MODEL);

export const aiConfig = {
  enabled: process.env.AI_ENABLED !== 'false',
  host: normalizeOllamaHost(process.env.OLLAMA_HOST),
  /** API 不可用时回落到直接扫描 manifests 目录 */
  modelsDir: modelsDirInfo.dir,
  /** 上面的目录是否真实存在；为 false 时扫描回落必然失败，值得在启动时告警 */
  modelsDirFound: modelsDirInfo.found,
  /** 显式白名单，逗号分隔；为空表示放行 API 返回的全部模型 */
  allowlist: String(process.env.AI_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  /**
   * 单个模型文件体积上限（GB），默认 24 —— 与本机 RTX 3090 的 24GB 显存对齐。
   * 超出上限的模型仍会出现在列表里，但标记为不可选，避免加载时 OOM。
   */
  maxModelSizeGb: numFloat(process.env.AI_MAX_MODEL_SIZE_GB, 24),
  /** 测试用模型；仅非生产环境生效，生产环境会被忽略并告警 */
  testModel: testModelInfo.model,
  testModelIgnoredInProduction: testModelInfo.ignoredInProduction,
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
