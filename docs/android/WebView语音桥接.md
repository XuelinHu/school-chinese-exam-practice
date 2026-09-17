# 安卓 WebView 语音桥接

H5 智能体支持语音对话（STT）与语音播报（TTS）。在浏览器里走 Web Speech API，
**在安卓 App 的 WebView 里优先走原生能力**——很多国产 WebView 内核不带
`webkitSpeechRecognition`，而且原生 `SpeechRecognizer` 对中文/马来语的识别率更好。

配套实现：`AgentVoiceBridge.kt`（与本文件同目录）。

## 一、接入步骤

```kotlin
val webView = findViewById<WebView>(R.id.webview)
val bridge = AgentVoiceBridge(this, webView)

// 必须在页面脚本执行前注入
webView.addJavascriptInterface(bridge, "AndroidVoice")

webView.settings.javaScriptEnabled = true
// 麦克风权限：H5 侧 getUserMedia / 原生 SpeechRecognizer 都需要
// AndroidManifest.xml: <uses-permission android:name="android.permission.RECORD_AUDIO" />
```

`AgentVoiceBridge` 需要 `Activity` 上下文来申请运行时权限与回调 `onActivityResult`。

## 二、JS → 原生（页面调用）

| 方法 | 参数 | 说明 |
|---|---|---|
| `AndroidVoice.startVoice(json)` | `{"lang":"zh-CN","mode":"dictation"}` | 开始一轮识别 |
| `AndroidVoice.stopVoice()` | — | 主动停止识别 |
| `AndroidVoice.speak(text, lang)` | 文本、语言 | 播报（文本已由 H5 清洗掉 Markdown/emoji） |
| `AndroidVoice.stopSpeak()` | — | 打断播报 |

`startVoice` 收到的是 **JSON 字符串**而不是对象——`addJavascriptInterface` 只支持基本类型。

## 三、原生 → JS（App 回调）

**必须在 UI 线程**通过 `webView.post { evaluateJavascript(...) }` 调用，
否则会抛 `RuntimeException: A WebView method was called on thread '...'`。

| 回调 | 参数 | 说明 |
|---|---|---|
| `window.__agentVoice.onStart()` | — | 开始收音 |
| `window.__agentVoice.onPartial(text)` | 中间结果 | 边说边出字 |
| `window.__agentVoice.onResult(text, isFinal)` | 最终结果 | `isFinal` 为 `true` 时是定稿 |
| `window.__agentVoice.onError(code, message)` | 错误码、描述 | 见下表 |
| `window.__agentVoice.onEnd()` | — | 本轮结束（成功或失败都会触发） |
| `window.__agentVoice.onSpeakStart()` | — | 开始播报 |
| `window.__agentVoice.onSpeakEnd()` | — | 播报结束 |

### 错误码约定

H5 侧把错误码收敛成四类，App 只要传这些值即可：

| code | 含义 | H5 提示 |
|---|---|---|
| `permission` / `9` | 没有麦克风权限 | 「麦克风权限被拒绝，请在浏览器设置中允许」 |
| `no-speech` / `no_match` / `7` | 没听到说话 | 静默处理，不打扰用户 |
| `network` / `2` | 识别服务不可达 | 显示原始 message |
| 其他 | 未知错误 | 显示原始 message |

> 上面括号里的数字是 Android `SpeechRecognizer.ERROR_*` 常量值，
> `AgentVoiceBridge.kt` 已经做了映射；自定义实现时照着传字符串也行。

## 四、H5 侧的探测顺序

`src/components/agent/voice/androidBridge.js` 的 `detectNativeVoice()` 按顺序探测：

1. `window.AndroidVoice`（本文档的方案，安卓原生）
2. `window.Capacitor?.Plugins?.AgentVoice`（Capacitor 项目）
3. `window.webkit?.messageHandlers?.AgentVoice`（iOS）
4. `window.SpeechRecognition || window.webkitSpeechRecognition`（浏览器自带）
5. 都没有 → 界面上显示「当前浏览器不支持语音识别，请使用 Chrome 或 App」

**STT 与 TTS 各自独立降级**：App 只接了麦克风没接 TTS 时，
播报会自动回落到 `speechSynthesis`，不会一起失效。

## 五、注意事项

- **权限申请要在 `startVoice` 里做**：先 `checkSelfPermission`，没有就
  `requestPermissions`，把结果缓存起来，回调后再真正启动识别。
- **`onDestroy` 必须释放资源**：`speechRecognizer.destroy()` 与 `tts.shutdown()`，
  否则会泄漏 `RecognitionService` 连接。
- **`SpeechRecognizer` 只能在主线程创建和调用**。
- **识别是单轮的**：`onResults` 之后要 `stopListening()`，不然部分机型会一直占着麦克风。
- **马来语（`ms-MY`）识别**：`RecognizerIntent.EXTRA_LANGUAGE` 传 `ms-MY`，
  设备没装马来语离线包时会回落到云端识别；真机上建议实测，
  识别率不佳时可以在这里回落成 `zh-CN`。
- **TTS 引擎**：`TextToSpeech` 初始化是异步的，要等 `OnInitListener` 回调成功后再 `speak`，
  否则第一次播报会静默失败。中文需要设备装有中文语音包。
- **`evaluateJavascript` 的字符串要转义**：识别结果里可能有引号或换行，
  统一走 `JSONObject.quote(text)` 包一层再拼进 JS 字符串。
