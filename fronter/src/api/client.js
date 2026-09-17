const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8033/api';

export { API_BASE };

const TOKEN_KEY = 'token';

export function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * 拼查询串。分页/筛选参数统一走这里，跳过空值，
 * 避免把 `?keyword=&page=1` 这种噪音发给后端。
 */
export function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** 令牌失效时广播，由 auth store 统一登出并跳转，避免这里反向依赖 store。 */
function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

function buildHeaders(extra = {}, { json = true } = {}) {
  const headers = { ...extra };
  if (json) headers['Content-Type'] = 'application/json';
  if (token()) headers.Authorization = `Bearer ${token()}`;
  return headers;
}

async function unwrap(response) {
  const payload = await response.json().catch(() => ({ message: 'Network error' }));
  if (response.status === 401) notifyUnauthorized();
  if (!response.ok || payload.code >= 400) {
    // 带上 status，页面可以针对 423（账号锁定）等做差异化提示
    const error = new Error(payload.message || 'Request failed');
    error.status = response.status || payload.code;
    error.payload = payload;
    throw error;
  }
  return payload.data;
}

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return unwrap(response);
}

/**
 * 上传二进制（头像）。
 *
 * 不用 FormData —— 后端用 `express.raw()` 收原始字节，零新依赖，
 * 前端 `File.arrayBuffer()` 直接发。类型由 magic bytes 在服务端二次校验。
 */
export async function requestRaw(path, blob) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': blob.type || 'application/octet-stream' }, { json: false }),
    body: blob
  });
  return unwrap(response);
}

/**
 * SSE 流式请求。
 *
 * `EventSource` 不支持 POST 和自定义头，所以用 `fetch` + `ReadableStream` 自己解帧。
 * 注意 SSE 直连后端端口，不走 Vite 代理（代理会缓冲，流式就没意义了）。
 *
 * @param {object} options
 * @param {AbortSignal} [options.signal] 用于"停止生成"与组件卸载时中断
 * @param {(event: object) => void} options.onEvent 每解析出一个 `data:` 帧回调一次
 */
export async function stream(path, { body, signal, onEvent } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Network error' }));
    if (response.status === 401) notifyUnauthorized();
    const error = new Error(payload.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以空行分帧；保留最后一段不完整的帧等下一块数据
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue; // `: ping` 心跳注释直接忽略
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          onEvent?.(JSON.parse(raw));
        } catch {
          // 半截 JSON 不该让整条流挂掉
        }
      }
    }
  }
}
