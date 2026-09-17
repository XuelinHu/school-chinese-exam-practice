/**
 * 浏览器 Web Speech API 封装（无原生桥时的回落方案）。
 *
 * 两个坑：
 *  1. `speechSynthesis.getVoices()` 首次调用往往返回空数组，音色是异步加载的 ——
 *     必须监听 `voiceschanged`，否则会静默用上默认音色（中文读成英文腔）。
 *  2. `SpeechRecognition` 只在安全上下文可用（HTTPS 或 localhost），
 *     普通 http 域名下 `start()` 会直接抛 not-allowed，要提前判断并给出明确提示。
 */

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export const browserSttSupported = Boolean(SpeechRecognition);
export const browserTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
// isSecureContext 在现代浏览器里恒为布尔值；老内核没有这个属性时再退回协议判断。
// 注意 `??` 与 `||` 混用必须加括号，否则 esbuild 直接报语法错误。
export const isSecure = typeof window !== 'undefined'
  ? (window.isSecureContext ?? (location.protocol === 'https:' || location.hostname === 'localhost'))
  : false;

// ---------------------------------------------------------------- 语音识别

export function browserSttProvider() {
  let recognition = null;
  let stopped = false;

  return {
    kind: 'browser',
    label: 'Web Speech',

    start({ lang, onStart, onPartial, onResult, onError, onEnd }) {
      if (!SpeechRecognition) {
        onError?.({ type: 'unsupported', message: 'SpeechRecognition is not available' });
        return;
      }
      if (!isSecure) {
        onError?.({ type: 'insecure', message: 'Speech recognition requires HTTPS or localhost' });
        return;
      }

      stopped = false;
      recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;      // 单轮听写，说完自动停
      recognition.interimResults = true;   // 边说边出字，交互更跟手
      recognition.maxAlternatives = 1;

      recognition.onstart = () => onStart?.();
      recognition.onresult = (event) => {
        let interim = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) onResult?.(text.trim(), true);
          else interim += text;
        }
        if (interim) onPartial?.(interim.trim());
      };
      recognition.onerror = (event) => {
        // 用户主动 stop() 时浏览器也会抛 aborted，不算错误
        if (stopped && event.error === 'aborted') return;
        onError?.(mapBrowserError(event.error));
      };
      recognition.onend = () => {
        recognition = null;
        onEnd?.();
      };

      try {
        recognition.start();
      } catch (error) {
        recognition = null;
        onError?.({ type: 'unknown', message: error.message });
      }
    },

    stop() {
      stopped = true;
      try {
        recognition?.stop();
      } catch {
        // 已经结束了，忽略
      }
    }
  };
}

function mapBrowserError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { type: 'permission', message: 'Microphone permission denied' };
    case 'no-speech':
      return { type: 'no-speech', message: 'No speech detected' };
    case 'audio-capture':
      return { type: 'no-microphone', message: 'No microphone found' };
    case 'network':
      return { type: 'network', message: 'Speech service unreachable' };
    default:
      return { type: 'unknown', message: `Speech error: ${code}` };
  }
}

// ---------------------------------------------------------------- 语音合成

let cachedVoices = [];

export function primeVoices() {
  if (!browserTtsSupported) return;
  const load = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) cachedVoices = voices;
  };
  load();
  // 首次为空是常态，音色加载完成后会再触发一次
  window.speechSynthesis.addEventListener?.('voiceschanged', load, { once: true });
}

/** 按 BCP-47 前缀挑音色：`zh-CN` → 找 `zh` 开头的；找不到就交给浏览器默认。 */
function pickVoice(lang) {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices();
  const prefix = String(lang).split('-')[0].toLowerCase();
  return (
    cachedVoices.find((voice) => voice.lang?.toLowerCase() === lang.toLowerCase()) ||
    cachedVoices.find((voice) => voice.lang?.toLowerCase().startsWith(prefix)) ||
    null
  );
}

export function browserTtsProvider() {
  return {
    kind: 'browser',
    async speak(text, lang, { onStart, onEnd } = {}) {
      if (!browserTtsSupported) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel(); // 打断上一段，实现 barge-in

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => onStart?.();
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();

      window.speechSynthesis.speak(utterance);
    },
    stop() {
      if (browserTtsSupported) window.speechSynthesis.cancel();
    }
  };
}

/**
 * 播报前清洗文本。
 *
 * 直接朗读 Markdown 会把 `**`、`###`、链接读成"星号星号"，emoji 在部分 TTS 上
 * 会念出名字，所以统一剥掉，只留能自然读出来的句子。
 */
export function toSpeakableText(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')            // 代码块
    .replace(/`([^`]*)`/g, '$1')                // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // 链接留文字
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')         // 标题
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // 粗体
    .replace(/\*([^*]+)\*/g, '$1')              // 斜体
    .replace(/^\s*[-*+]\s+/gm, '')              // 无序列表
    .replace(/^\s*\d+\.\s+/gm, '')              // 有序列表
    .replace(/^\s*>\s?/gm, '')                  // 引用
    .replace(/\|/g, ' ')                        // 表格竖线
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '') // emoji
    .replace(/\n{2,}/g, '。')
    .replace(/\s+/g, ' ')
    .trim();
}
