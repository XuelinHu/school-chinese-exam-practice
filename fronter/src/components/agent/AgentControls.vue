<template>
  <div class="agent-controls">
    <button
      class="agent-btn"
      :class="{ 'is-on': listening }"
      type="button"
      :disabled="!canListen"
      :title="micTitle"
      @click="toggleMic"
    >
      <span class="agent-btn-icon">{{ listening ? '⏺' : '🎙' }}</span>
      <span class="agent-btn-text">{{ listening ? t('listening') : t('holdToTalk') }}</span>
    </button>

    <button
      class="agent-btn"
      :class="{ 'is-on': speaking }"
      type="button"
      :disabled="!canSpeak"
      :title="t('speak')"
      @click="$emit('toggle-speak')"
    >
      <span class="agent-btn-icon">{{ speaking ? '🔊' : '🔈' }}</span>
      <span class="agent-btn-text">{{ speaking ? t('speaking') : t('speak') }}</span>
    </button>

    <select
      class="agent-lang"
      :value="lang"
      :title="t('language')"
      @change="$emit('update:lang', $event.target.value)"
    >
      <option v-for="item in LANGUAGES" :key="item.code" :value="item.code">{{ item.label }}</option>
    </select>

    <button class="agent-btn" type="button" :title="t('newSession')" @click="$emit('new-session')">
      <span class="agent-btn-icon">＋</span>
      <span class="agent-btn-text">{{ t('newSession') }}</span>
    </button>
  </div>

  <!-- 语音不可用时给明确原因，不静默失败 -->
  <p v-if="!canListen" class="agent-note">{{ t(unavailableReason === 'insecure' ? 'insecureContext' : 'voiceUnsupported') }}</p>
  <p v-else-if="usingNative" class="agent-note muted">{{ t('voiceViaApp') }}</p>

  <p v-if="errorText" class="agent-note error">{{ errorText }}</p>
  <p v-if="interim" class="agent-note interim">{{ interim }}</p>
</template>

<script setup>
import { computed } from 'vue';
import { t, LANGUAGES } from '../../i18n/index.js';

/**
 * voice 是 useVoice() 的返回值，其中 `state` 是 reactive 对象（直接取值），
 * 其余是 computed ref。这里统一包一层 local computed，模板里就不用纠结 `.value`。
 */
const props = defineProps({
  voice: { type: Object, required: true },
  lang: { type: String, default: 'zh-CN' }
});

const emit = defineEmits(['update:lang', 'toggle-speak', 'new-session', 'listen']);

const listening = computed(() => props.voice.state.listening);
const speaking = computed(() => props.voice.state.speaking);
const interim = computed(() => props.voice.state.interim);
const canListen = computed(() => props.voice.canListen.value);
const canSpeak = computed(() => props.voice.canSpeak.value);
const usingNative = computed(() => props.voice.usingNative.value);
const unavailableReason = computed(() => props.voice.unavailableReason.value);

const micTitle = computed(() => (listening.value ? t('stopGenerating') : t('holdToTalk')));

const errorText = computed(() => {
  const error = props.voice.state.error;
  if (!error) return '';
  if (error.type === 'permission') return t('micDenied');
  if (error.type === 'insecure') return t('insecureContext');
  if (error.type === 'unsupported') return t('voiceUnsupported');
  return error.message || t('voiceUnsupported');
});

function toggleMic() {
  if (listening.value) props.voice.stopListening();
  else emit('listen');
}
</script>
