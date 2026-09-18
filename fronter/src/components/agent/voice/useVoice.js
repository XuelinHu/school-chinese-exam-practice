import { reactive, computed, onUnmounted } from 'vue';
import {
  browserSttProvider,
  browserTtsProvider,
  browserSttSupported,
  browserTtsSupported,
  isSecure,
  primeVoices,
  toSpeakableText
} from './speech.js';

/**
 * 语音能力的统一编排：识别（STT）与播报（TTS）**各自独立**判断可用性。
 *
 * 全 H5：只走浏览器 Web Speech，没有原生桥。两者可用条件不同 ——
 * 识别要安全上下文（HTTPS 或 localhost），`speechSynthesis` 不需要 ——
 * 所以「公网 http 下能播报但不能识别」是预期状态，不能合并成一个开关。
 */
export function useVoice() {
  const stt = browserSttSupported ? browserSttProvider() : null;
  const tts = browserTtsSupported ? browserTtsProvider() : null;

  const state = reactive({
    /** 'browser' | null */
    sttProvider: stt?.kind || null,
    ttsProvider: tts?.kind || null,
    listening: false,
    transcript: '',
    interim: '',
    speaking: false,
    /** 最近一次错误，页面据此给提示 */
    error: null,
    autoSpeak: false
  });

  /**
   * 识别可用 = 浏览器有接口 **且** 处于安全上下文。
   *
   * 两个条件都得看：Chrome 在普通 http 下照样暴露 `webkitSpeechRecognition`，
   * 只判断 `Boolean(stt)` 会让按钮亮着、由用户点下去才报错 —— 那正是公网裸 IP
   * 入口上的情形。安全上下文是页面级常量，不会中途改变。
   */
  const canListen = computed(() => Boolean(stt) && isSecure);
  const canSpeak = computed(() => Boolean(tts));

  /** 不可用原因，页面直接拿去显示对应文案。 */
  const unavailableReason = computed(() => {
    if (canListen.value) return '';
    if (!browserSttSupported) return 'unsupported';
    return 'insecure';
  });

  /**
   * 开始一轮识别，说完（或被取消）时 resolve。
   *
   * @returns {Promise<{ text: string, reason?: string }>}
   */
  function startListening({ lang = 'zh-CN' } = {}) {
    if (!stt) return Promise.resolve({ text: '', reason: 'unsupported' });

    state.transcript = '';
    state.interim = '';
    state.error = null;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        state.listening = false;
        state.interim = '';
        resolve(payload);
      };

      stt.start({
        lang,
        onStart: () => { state.listening = true; state.error = null; },
        onPartial: (text) => { state.interim = text; },
        onResult: (text) => { state.transcript = text; state.interim = ''; },
        onError: (error) => {
          state.error = error;
          finish({ text: '', reason: error.type });
        },
        onEnd: () => {
          const text = (state.transcript || state.interim || '').trim();
          finish({ text, reason: text ? undefined : 'no-speech' });
        }
      });
    });
  }

  function stopListening() {
    stt?.stop();
    state.listening = false;
    state.interim = '';
  }

  /** 播报一段文本；传入原始 Markdown，内部会清洗后再读。 */
  async function speak(text, lang = 'zh-CN') {
    if (!tts) return;
    const clean = toSpeakableText(text);
    if (!clean) return;

    state.speaking = true;
    await tts.speak(clean, lang, {
      onStart: () => { state.speaking = true; },
      onEnd: () => { state.speaking = false; }
    });
  }

  function stopSpeaking() {
    tts?.stop();
    state.speaking = false;
  }

  function toggleAutoSpeak(value) {
    state.autoSpeak = value ?? !state.autoSpeak;
    if (!state.autoSpeak) stopSpeaking();
    return state.autoSpeak;
  }

  // 提前加载音色，避免第一次播报用的是默认音
  if (tts) primeVoices();

  onUnmounted(() => {
    stopListening();
    stopSpeaking();
  });

  return {
    state, canListen, canSpeak, unavailableReason,
    startListening, stopListening, speak, stopSpeaking, toggleAutoSpeak
  };
}
