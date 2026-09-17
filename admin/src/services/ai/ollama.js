import fs from 'node:fs/promises';
import path from 'node:path';
import { aiConfig } from '../../config/ai.js';
import { logger } from '../../utils/logger.js';

/**
 * 与 Ollama HTTP API 交互的唯一入口。
 *
 * 实测（Ollama 0.19.0 + qwen3:14b）：
 * - `/api/chat` 的 `tool_calls[].function.arguments` 已经是**对象**，不是 JSON 字符串，
 *   与 OpenAI 协议不同，回灌时不要再 JSON.parse。
 * - `think:false` 可关闭 qwen3 的思考输出。
 * - 冷加载一个 14B 模型约 20 秒，因此 `loadModel` 预热很有必要。
 */

const CACHE_TTL_MS = 30_000;
let modelCache = { at: 0, models: null };

export class OllamaError extends Error {
  constructor(message, { status = 502, code = 'OLLAMA_ERROR' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function ollamaFetch(endpoint, { method = 'GET', body, signal, timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || aiConfig.timeoutMs);
  // 调用方传入的 signal 也要能中断底层请求
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(`${aiConfig.host}${endpoint}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OllamaError(`Ollama ${endpoint} failed (${response.status}): ${text.slice(0, 300)}`, {
        status: response.status === 404 ? 404 : 502
      });
    }
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new OllamaError(signal?.aborted ? 'Request cancelled' : `Ollama ${endpoint} timed out`, {
        status: 499,
        code: 'ABORTED'
      });
    }
    if (error instanceof OllamaError) throw error;
    throw new OllamaError(`Cannot reach Ollama at ${aiConfig.host}: ${error.message}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function formatSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function normalizeModel(entry) {
  const details = entry.details || {};
  return {
    name: entry.name || entry.model,
    provider: 'ollama',
    size: entry.size || 0,
    sizeText: formatSize(entry.size),
    family: details.family || '',
    parameterSize: details.parameter_size || '',
    quantization: details.quantization_level || '',
    modifiedAt: entry.modified_at || null
  };
}

/** 从 manifests 目录推断已下载的模型名（`/api/tags` 不可用时的回落）。 */
async function scanModelsDir() {
  const manifestsRoot = path.join(aiConfig.modelsDir, 'manifests');
  const found = new Map();

  async function walk(dir, segments) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(next, [...segments, entry.name]);
        continue;
      }
      // manifests/<registry>/<namespace>/<model>/<tag>
      if (segments.length >= 4) {
        const [registry, ...rest] = segments;
        if (!registry.includes('ollama')) continue;
        const tag = entry.name;
        const model = rest[rest.length - 1];
        const namespace = rest.length > 1 ? rest[0] : 'library';
        const name = namespace === 'library' ? `${model}:${tag}` : `${namespace}/${model}:${tag}`;
        found.set(name, {
          name,
          provider: 'ollama',
          size: 0,
          sizeText: '',
          family: '',
          parameterSize: '',
          quantization: '',
          modifiedAt: null,
          source: 'manifests'
        });
      }
    }
  }

  await walk(manifestsRoot, []);
  return [...found.values()];
}

function applyAllowlist(models) {
  const list = aiConfig.allowlist.length
    ? models.filter((model) => aiConfig.allowlist.includes(model.name))
    : models;
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** 列出本机已下载的模型。 */
export async function listModels({ refresh = false } = {}) {
  if (!refresh && modelCache.models && Date.now() - modelCache.at < CACHE_TTL_MS) {
    return modelCache.models;
  }

  let models;
  let source = 'api';
  try {
    const response = await ollamaFetch('/api/tags', { timeoutMs: 5000 });
    const payload = await response.json();
    models = (payload.models || []).map(normalizeModel);
  } catch (error) {
    logger.warn('Ollama /api/tags unavailable, falling back to manifests scan', { message: error.message });
    models = await scanModelsDir();
    source = 'manifests';
  }

  models = applyAllowlist(models);
  modelCache = { at: Date.now(), models };
  return models.map((model) => ({ ...model, source }));
}

/** 当前已加载进内存/显存的模型。 */
export async function runningModels() {
  try {
    const response = await ollamaFetch('/api/ps', { timeoutMs: 5000 });
    const payload = await response.json();
    return (payload.models || []).map((entry) => ({
      name: entry.name || entry.model,
      size: entry.size || 0,
      sizeVram: entry.size_vram || 0,
      sizeText: formatSize(entry.size || 0),
      expiresAt: entry.expires_at || null
    }));
  } catch {
    return [];
  }
}

export async function health() {
  try {
    const response = await ollamaFetch('/api/version', { timeoutMs: 5000 });
    const payload = await response.json();
    const models = await listModels();
    return { reachable: true, version: payload.version, host: aiConfig.host, modelCount: models.length };
  } catch (error) {
    return { reachable: false, host: aiConfig.host, error: error.message };
  }
}

/**
 * 预热模型：空提示 + keep_alive 让它常驻，避免用户第一次提问等 20 秒冷加载。
 * 传 keep_alive: 0 则可主动卸载释放内存。
 */
export async function loadModel(name, { keepAlive = aiConfig.keepAlive } = {}) {
  const startedAt = Date.now();
  const response = await ollamaFetch('/api/generate', {
    method: 'POST',
    body: { model: name, prompt: '', keep_alive: keepAlive, stream: false },
    // 冷加载 14B 实测约 20s，给足余量
    timeoutMs: Math.max(aiConfig.timeoutMs, 180_000)
  });
  const payload = await response.json();
  return {
    model: name,
    loaded: true,
    keepAlive,
    loadDurationMs: Math.round((payload.load_duration || 0) / 1e6) || Date.now() - startedAt
  };
}

export async function unloadModel(name) {
  await loadModel(name, { keepAlive: 0 });
  return { model: name, loaded: false };
}

/** 读取模型元信息（模板、参数），用于判断是否具备工具调用能力。 */
export async function showModel(name) {
  const response = await ollamaFetch('/api/show', { method: 'POST', body: { model: name }, timeoutMs: 15_000 });
  return response.json();
}

/**
 * 发起一次对话补全。
 *
 * @param {object} options
 * @param {string} options.model
 * @param {Array} options.messages
 * @param {Array} [options.tools]   Ollama 原生工具定义
 * @param {boolean} [options.stream] 是否返回 NDJSON 响应流
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{content: string, toolCalls: Array, thinking: string, raw: object}>}
 *          非流式时返回聚合结果；流式时返回 `{ stream }` 由调用方消费。
 */
export async function chat({ model, messages, tools, stream = false, signal, think = false, options = {} }) {
  const body = {
    model,
    messages,
    stream,
    think,
    keep_alive: aiConfig.keepAlive,
    options: { num_ctx: aiConfig.numCtx, ...options }
  };
  if (tools?.length) body.tools = tools;

  const response = await ollamaFetch('/api/chat', { method: 'POST', body, signal });

  if (stream) return { stream: response.body };

  const payload = await response.json();
  const message = payload.message || {};
  return {
    content: message.content || '',
    toolCalls: message.tool_calls || [],
    thinking: message.thinking || '',
    raw: payload
  };
}

/**
 * 把 NDJSON 响应流解析成事件序列。
 * @param {ReadableStream} body
 * @yields {{type:'delta'|'tool_calls'|'thinking'|'done', ...}}
 */
export async function* readNdjson(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;

        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }

        if (payload.error) throw new OllamaError(payload.error);
        const message = payload.message || {};
        if (message.thinking) yield { type: 'thinking', text: message.thinking };
        if (message.content) yield { type: 'delta', text: message.content };
        if (message.tool_calls?.length) yield { type: 'tool_calls', toolCalls: message.tool_calls };
        if (payload.done) yield { type: 'done', raw: payload };
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

/** 模型能力探测结果缓存（`/api/show` 会读模型元数据，避免每次对话都调用）。 */
const capabilityCache = new Map();

export async function supportsTools(model) {
  if (capabilityCache.has(model)) return capabilityCache.get(model);
  try {
    const info = await showModel(model);
    const template = String(info.template || '');
    const hasTools = /\.Tools\b|tool_calls|"tools"/.test(template);
    capabilityCache.set(model, hasTools);
    return hasTools;
  } catch (error) {
    logger.warn('Tool capability probe failed, assuming supported', { model, message: error.message });
    // 探测失败时不阻断：让工具调用先跑一轮，失败后由 agent 降级
    return true;
  }
}

/** 管理员在设置页切换模型后清掉缓存。 */
export function invalidateModelCache() {
  modelCache = { at: 0, models: null };
}
