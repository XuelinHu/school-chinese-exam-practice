/**
 * 原生语音桥接（安卓优先，兼容 iOS / Capacitor）。
 *
 * H5 跑在安卓 WebView 里时，浏览器自带的 `webkitSpeechRecognition` 在很多国产
 * WebView 内核上不可用；马来语 `ms-MY` 的识别率也不理想。所以优先走宿主 App 的
 * 原生能力：安卓用 `SpeechRecognizer` + `TextToSpeech`，由 App 通过
 * `addJavascriptInterface` 暴露给页面。
 *
 * ## 契约
 *
 * JS → 原生（页面调用）：
 *   window.AndroidVoice.startVoice(jsonString)  // {"lang":"zh-CN","mode":"dictation"}
 *   window.AndroidVoice.stopVoice()
 *   window.AndroidVoice.speak(text, lang)
 *   window.AndroidVoice.stopSpeak()
 *
 * 原生 → JS（App 端必须在 UI 线程 `view.post { webView.evaluateJavascript(...) }`）：
 *   window.__agentVoice.onStart()
 *   window.__agentVoice.onPartial(text)
 *   window.__agentVoice.onResult(text, isFinal)
 *   window.__agentVoice.onError(code, message)
 *   window.__agentVoice.onEnd()
 *   window.__agentVoice.onSpeakStart() / onSpeakEnd()
 *
 * 安卓实现见 `docs/android/AgentVoiceBridge.kt`。
 */

/** 探测当前可用的原生语音实现。顺序即优先级。 */
export function detectNativeVoice() {
  if (typeof window === 'undefined') return null;

  if (window.AndroidVoice?.startVoice) {
    return { kind: 'android', label: 'Android', impl: window.AndroidVoice, speak: Boolean(window.AndroidVoice.speak) };
  }

  const capacitor = window.Capacitor?.Plugins?.AgentVoice;
  if (capacitor?.startVoice) {
    return { kind: 'capacitor', label: 'Capacitor', impl: capacitor, speak: Boolean(capacitor.speak) };
  }

  if (window.webkit?.messageHandlers?.AgentVoice?.postMessage) {
    const handler = window.webkit.messageHandlers.AgentVoice;
    return {
      kind: 'ios',
      label: 'iOS',
      speak: true,
      // iOS 侧没有返回值，统一 postMessage 一个动作对象
      impl: {
        startVoice: (payload) => handler.postMessage({ action: 'startVoice', payload }),
        stopVoice: () => handler.postMessage({ action: 'stopVoice' }),
        speak: (text, lang) => handler.postMessage({ action: 'speak', text, lang }),
        stopSpeak: () => handler.postMessage({ action: 'stopSpeak' })
      }
    };
  }

  return null;
}

/**
 * 注册原生 → JS 的回调入口。
 *
 * 只挂一个 `window.__agentVoice`，由 useVoice 把事件分发到当前活跃的监听器；
 * 原生端不需要知道页面上是谁在听。
 */
export function installNativeCallbacks(handlers = {}) {
  if (typeof window === 'undefined') return () => {};

  const dispatch = (name, ...args) => {
    try {
      handlers[name]?.(...args);
    } catch (error) {
      // 回调里抛异常会顺着 evaluateJavascript 传回原生，直接吞掉更安全
      console.warn(`[agentVoice] handler ${name} failed`, error);
    }
  };

  window.__agentVoice = {
    onStart: () => dispatch('onStart'),
    onPartial: (text) => dispatch('onPartial', String(text ?? '')),
    onResult: (text, isFinal = true) => dispatch('onResult', String(text ?? ''), isFinal !== false),
    onError: (code, message) => dispatch('onError', String(code ?? 'unknown'), String(message ?? '')),
    onEnd: () => dispatch('onEnd'),
    onSpeakStart: () => dispatch('onSpeakStart'),
    onSpeakEnd: () => dispatch('onSpeakEnd')
  };

  return () => {
    if (window.__agentVoice) delete window.__agentVoice;
  };
}

// ---------------------------------------------------------------- STT 提供方

export function nativeSttProvider(native) {
  let active = null;

  return {
    kind: native.kind,
    label: native.label,

    start({ lang, onStart, onPartial, onResult, onError, onEnd }) {
      active = { onStart, onPartial, onResult, onError, onEnd };
      native.impl.startVoice(JSON.stringify({ lang, mode: 'dictation' }));
    },

    stop() {
      native.impl.stopVoice?.();
    },

    /** 由 useVoice 从 `window.__agentVoice` 回调转发进来。 */
    handle(name, ...args) {
      switch (name) {
        case 'onStart': active?.onStart?.(); break;
        case 'onPartial': active?.onPartial?.(args[0]); break;
        case 'onResult': active?.onResult?.(args[0], args[1]); break;
        case 'onError': {
          const [code, message] = args;
          active?.onError?.(mapNativeError(code, message));
          active = null;
          break;
        }
        case 'onEnd':
          active?.onEnd?.();
          active = null;
          break;
        default: break;
      }
    }
  };
}

/** 把原生错误码收敛成页面认识的几种。 */
function mapNativeError(code, message) {
  const value = String(code || '').toLowerCase();
  if (value.includes('permission') || value.includes('not_allowed') || value === '9') {
    return { type: 'permission', message: message || 'Microphone permission denied' };
  }
  if (value.includes('no_match') || value.includes('no_speech') || value === '7') {
    return { type: 'no-speech', message: message || 'No speech detected' };
  }
  if (value.includes('network') || value === '2') {
    return { type: 'network', message: message || 'Speech service unreachable' };
  }
  return { type: 'unknown', message: message || `Speech error: ${code}` };
}

// ---------------------------------------------------------------- TTS 提供方

export function nativeTtsProvider(native) {
  // 每个 provider 实例各自持有回调，避免多实例互相覆盖
  let pending = { onStart: null, onEnd: null };

  return {
    kind: native.kind,
    async speak(text, lang, { onStart, onEnd } = {}) {
      pending = { onStart, onEnd };
      native.impl.speak(text, lang);
    },
    stop() {
      native.impl.stopSpeak?.();
      pending = { onStart: null, onEnd: null };
    },
    handle(name) {
      if (name === 'onSpeakStart') pending.onStart?.();
      if (name === 'onSpeakEnd') {
        const { onEnd } = pending;
        pending = { onStart: null, onEnd: null };
        onEnd?.();
      }
    }
  };
}
