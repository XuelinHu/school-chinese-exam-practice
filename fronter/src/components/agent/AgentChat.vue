<template>
  <div class="agent-chat">
    <div ref="scroller" class="agent-stream">
      <!-- 欢迎语 + 推荐问题 -->
      <div v-if="!messages.length" class="agent-hello">
        <p class="agent-hello-text">{{ meta.greeting || t('askMe') }}</p>
        <div v-if="meta.suggestions?.length" class="agent-suggest">
          <p class="muted agent-suggest-title">{{ t('suggestions') }}</p>
          <button
            v-for="(item, index) in meta.suggestions"
            :key="index"
            class="agent-chip"
            type="button"
            @click="$emit('ask', item)"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div v-for="(message, index) in messages" :key="index" class="agent-turn" :class="`is-${message.role}`">
        <div class="agent-bubble">
          <p v-if="message.tool" class="agent-tool">
            <span class="agent-tool-dot" />{{ t('toolRunning') }}
            <code>{{ message.tool }}</code>
          </p>
          <!-- eslint-disable-next-line vue/no-v-html -- formatAgentText 先转义 HTML 再补自己的标签 -->
          <p v-if="message.content" class="agent-text" v-html="formatAgentText(message.content)" />
          <p v-else-if="message.streaming" class="agent-typing">{{ t('thinking') }}</p>
        </div>
        <button
          v-if="message.role === 'assistant' && message.content && !message.streaming"
          class="agent-replay"
          type="button"
          :title="t('speak')"
          @click="$emit('speak', message.content)"
        >
          🔈
        </button>
      </div>

      <p v-if="error" class="agent-note error">{{ error }}</p>
    </div>

    <AgentControls
      :voice="voice"
      :lang="lang"
      @update:lang="$emit('update:lang', $event)"
      @toggle-speak="$emit('toggle-speak')"
      @new-session="$emit('new-session')"
      @listen="$emit('listen')"
    />

    <form class="agent-input" @submit.prevent="submit">
      <textarea
        v-model="draft"
        rows="1"
        :placeholder="t('askPlaceholder')"
        :disabled="sending"
        @keydown.enter.exact.prevent="submit"
      />
      <button v-if="sending" class="btn danger" type="button" @click="$emit('stop')">
        {{ t('stopGenerating') }}
      </button>
      <button v-else class="btn" type="submit" :disabled="!draft.trim()">
        {{ t('send') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import AgentControls from './AgentControls.vue';
import { formatAgentText } from './format.js';
import { t } from '../../i18n/index.js';

const props = defineProps({
  messages: { type: Array, default: () => [] },
  meta: { type: Object, default: () => ({}) },
  voice: { type: Object, required: true },
  lang: { type: String, default: 'zh-CN' },
  sending: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

const emit = defineEmits(['ask', 'stop', 'speak', 'listen', 'toggle-speak', 'new-session', 'update:lang']);

const draft = ref('');
const scroller = ref(null);

function submit() {
  const text = draft.value.trim();
  if (!text || props.sending) return;
  draft.value = '';
  emit('ask', text);
}

// 流式输出时保持贴底；用户往上翻则不打扰
watch(
  () => props.messages.map((message) => message.content).join('').length,
  async () => {
    await nextTick();
    const element = scroller.value;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (nearBottom) element.scrollTop = element.scrollHeight;
  }
);
</script>
