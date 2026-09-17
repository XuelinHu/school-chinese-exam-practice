import { reactive, computed, onUnmounted } from 'vue';
import { detectNativeVoice, installNativeCallbacks, nativeSttProvider, nativeTtsProvider } from './androidBridge.js';
import {
  browserSttProvider,
  browserTtsProvider,
  browserSttSupported,
  browserTtsSupported,
  primeVoices,
  toSpeakableText
} from './speech.js';

/**
 * 语音能力的统一编排：识别（STT）与播报（TTS）**各自独立**挑提供方。
 *
 * 「安卓原生麦克风 + 浏览器合成」这种组合是允许的 —— App 只接了麦克风没接 TTS
 * 时，不该把播报也一起降级掉。
 *
 * STT 优先级：安卓桥 → Capacitor → iOS 桥 → Web Speech → 明确报不支持
 * TTS 优先级：原生桥 → Web Speech
 */
export function useVoice() {
  const native = detectNativeVoice();

  const stt = native ? nativeSttProvider(native) : (browserSttSupported ? browserSttProvider() : null);
  const tts = native?.speak ? nativeTtsProvider(native) : (browserTtsSupported ? browserTtsProvider() : null);

  const state = reactive({
    /** 'android' | 'capacitor' | 'ios' | 'browser' | null */
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

  // 原生事件只注册一次，路由给当前活跃的 provider 自己的状态机
  installNativeCallbacks({
    onStart: () => stt?.handle?.('onStart'),
    onPartial: (text) => stt?.handle?.('onPartial', text),
    onResult: (text, isFinal) => stt?.handle?.('onResult', text, isFinal),
    onError: (code, message) => stt?.handle?.('onError', code, message),
    onEnd: () => stt?.handle?.('onEnd'),
    onSpeakStart: () => tts?.handle?.('onSpeakStart'),
    onSpeakEnd: () => tts?.handle?.('onSpeakEnd')
  });

  const canListen = computed(() => Boolean(stt));
  const canSpeak = computed(() => Boolean(tts));

  /** 不可用原因，页面直接拿去显示对应文案。 */
  const unavailableReason = computed(() => {
    if (canListen.value) return '';
    return browserSttSupported ? 'insecure' : 'unsupported';
  });

  /** 当前是否走原生桥（页面据此显示「App 原生麦克风」）。 */
  const usingNative = computed(() => Boolean(native));

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
  if (tts?.kind === 'browser') primeVoices();

  onUnmounted(() => {
    stopListening();
    stopSpeaking();
  });

  return {
    state, canListen, canSpeak, unavailableReason, usingNative,
    startListening, stopListening, speak, stopSpeaking, toggleAutoSpeak
  };
}
