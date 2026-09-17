import { request, qs, stream, requestRaw } from './client.js';

/** 智能体相关的接口封装。 */

export function agentMeta({ scene = 'student', lang = 'zh-CN' } = {}) {
  return request(`/ai/agent${qs({ scene, lang })}`);
}

export function health() {
  return request('/ai/health');
}

export function models({ refresh = false } = {}) {
  return request(`/ai/models${qs({ refresh: refresh ? 'true' : '' })}`);
}

export function loadModel(model) {
  return request('/ai/models/load', { method: 'POST', body: { model } });
}

export function unloadModel(model) {
  return request('/ai/models/unload', { method: 'POST', body: { model } });
}

export function sessions({ page = 1, pageSize = 20, scene, all } = {}) {
  return request(`/ai/sessions${qs({ page, pageSize, scene, all: all ? 'true' : '' })}`);
}

export function sessionMessages(id, { page = 1, pageSize = 50 } = {}) {
  return request(`/ai/sessions/${id}/messages${qs({ page, pageSize })}`);
}

export function deleteSession(id) {
  return request(`/ai/sessions/${id}`, { method: 'DELETE' });
}

/**
 * 发一条消息并消费 SSE 事件流。
 *
 * @param {object} options
 * @param {(event: object) => void} options.onEvent 事件类型见后端 runAgent：
 *   `meta | tool_call | tool_result | delta | round_discard | done | error`
 * @param {AbortSignal} [options.signal] 用于「停止生成」
 */
export function chat({ message, sessionId, scene, lang, model, signal, onEvent }) {
  return stream('/ai/chat', {
    body: { message, sessionId, scene, lang, model },
    signal,
    onEvent
  });
}

export { requestRaw };
