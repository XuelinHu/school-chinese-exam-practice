<template>
  <!-- 右下角悬浮球：学员看到「汉语助教」，管理员看到「平台助手」 -->
  <button class="agent-fab" type="button" :title="title" @click="open">
    <span class="agent-fab-icon">💬</span>
    <span class="agent-fab-label">{{ title }}</span>
  </button>

  <AppModal v-model="visible" plain size="lg" :close-on-esc="!sending">
    <div class="agent-shell">
      <header class="agent-head">
        <div>
          <strong>{{ title }}</strong>
          <p class="muted agent-sub">
            {{ model || t('model') }}
            <span v-if="voice.usingNative.value"> · {{ t('voiceViaApp') }}</span>
          </p>
        </div>
        <div class="row">
          <button class="btn ghost btn-sm" type="button" @click="pickerOpen = !pickerOpen">
            {{ t('model') }}
          </button>
          <button class="modal-x" type="button" :aria-label="t('close')" @click="visible = false">×</button>
        </div>
      </header>

      <AgentModelPicker v-if="pickerOpen" :model="model" @update:model="model = $event" />

      <AgentChat
        :messages="messages"
        :meta="meta"
        :voice="voice"
        :lang="lang"
        :sending="sending"
        :error="error"
        @ask="send"
        @stop="stop"
        @speak="speak"
        @listen="listen"
        @toggle-speak="toggleSpeak"
        @new-session="newSession"
        @update:lang="switchLang"
      />
    </div>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import AppModal from '../AppModal.vue';
import AgentChat from './AgentChat.vue';
import AgentModelPicker from './AgentModelPicker.vue';
import { agentMeta, chat, models as fetchModels } from '../../api/ai.js';
import { useVoice } from './voice/useVoice.js';
import { authStore as auth } from '../../stores/auth.js';
import { t, state as i18nState, setLang } from '../../i18n/index.js';

const visible = ref(false);
const pickerOpen = ref(false);
const sending = ref(false);
const error = ref('');
const model = ref('');
const lang = ref(i18nState.lang);
const meta = ref({});
const messages = ref([]);
let sessionId = null;
let controller = null;

const voice = useVoice();

/** 场景跟着角色走：管理员默认进管理助手，学员进学习助教。 */
const scene = computed(() => (auth.isAdmin ? 'admin' : 'student'));
const title = computed(() => meta.value.name || (auth.isAdmin ? t('agentAdmin') : t('agentTutor')));

async function loadMeta() {
  try {
    meta.value = await agentMeta({ scene: scene.value, lang: lang.value });
    if (meta.value.defaultModel && !model.value) model.value = meta.value.defaultModel;
  } catch (err) {
    error.value = err.message;
  }
}

function open() {
  visible.value = true;
  if (!meta.value.greeting) loadMeta();
  if (!model.value) {
    // 弹框打开即后台预热：冷加载约 20s，提前触发能省掉用户第一次提问的等待
    fetchModels()
      .then((data) => {
        if (!model.value) model.value = data.defaultModel || data.models?.[0]?.name || '';
      })
      .catch(() => {});
  }
}

function pushTurn(role, content = '') {
  messages.value.push({ role, content, streaming: role === 'assistant' });
}

function send(text) {
  if (sending.value) return;
  error.value = '';

  // 新一轮提问先打断正在播报的内容（barge-in）
  voice.stopSpeaking();

  pushTurn('user', text);
  pushTurn('assistant');

  sending.value = true;
  controller = new AbortController();

  chat({
    message: text,
    sessionId,
    scene: scene.value,
    lang: lang.value,
    model: model.value || undefined,
    signal: controller.signal,
    onEvent: handleEvent
  })
    .catch((err) => {
      if (err.name !== 'AbortError') error.value = err.message;
    })
    .finally(() => {
      sending.value = false;
      controller = null;
      const last = messages.value[messages.value.length - 1];
      if (last?.streaming) last.streaming = false;
    });
}

function handleEvent(event) {
  const last = messages.value[messages.value.length - 1];
  if (!last || last.role !== 'assistant') return;

  switch (event.type) {
    case 'meta':
      if (event.sessionId) sessionId = event.sessionId;
      break;
    case 'tool_call':
      last.tool = event.name;
      break;
    case 'tool_result':
      last.tool = '';
      break;
    case 'delta':
      last.content += event.text;
      break;
    case 'round_discard':
      // 模型先说了段草稿又决定调工具，那段不该留在界面上
      last.content = '';
      break;
    case 'error':
      error.value = event.message;
      last.streaming = false;
      break;
    case 'done':
      last.streaming = false;
      if (voice.state.autoSpeak && last.content) speak(last.content);
      break;
    default:
      break;
  }
}

function stop() {
  controller?.abort();
  sending.value = false;
  const last = messages.value[messages.value.length - 1];
  if (last?.streaming) last.streaming = false;
}

async function listen() {
  const { text, reason } = await voice.startListening({ lang: speechLang() });
  if (text) send(text);
  else if (reason && reason !== 'no-speech') error.value = t('voiceUnsupported');
}

function speak(text) {
  voice.speak(text, speechLang());
}

function toggleSpeak() {
  // 正在播报 → 停；否则重播最后一条助手消息
  if (voice.state.speaking) {
    voice.stopSpeaking();
    return;
  }
  const last = [...messages.value].reverse().find((message) => message.role === 'assistant' && message.content);
  if (last) {
    voice.toggleAutoSpeak(true);
    speak(last.content);
  } else {
    voice.toggleAutoSpeak();
  }
}

/** 识别/合成用的 BCP-47：界面语言即语音语言。 */
function speechLang() {
  return lang.value;
}

async function switchLang(next) {
  lang.value = next;
  setLang(next);
  // 语言偏好落库，换设备也生效
  if (auth.user) {
    auth.user = { ...auth.user, language: next };
    localStorage.setItem('user', JSON.stringify(auth.user));
    await import('../../api/client.js')
      .then(({ request }) => request('/auth/profile', { method: 'PUT', body: { language: next } }))
      .catch(() => {});
  }
  await loadMeta();
}

function newSession() {
  stop();
  voice.stopSpeaking();
  sessionId = null;
  messages.value = [];
  error.value = '';
}

onMounted(() => {
  // 打开前就把欢迎语准备好，点击时无延迟
  loadMeta();
});

watch(
  () => i18nState.lang,
  (next) => {
    if (next !== lang.value) lang.value = next;
  }
);
</script>
