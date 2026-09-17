package com.example.chinesepractice.voice

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.Locale

/**
 * 安卓 WebView 语音桥：SpeechRecognizer（STT）+ TextToSpeech（TTS）。
 *
 * 用法（必须在页面加载前注入）：
 * ```
 * val bridge = AgentVoiceBridge(this, webView)
 * webView.addJavascriptInterface(bridge, "AndroidVoice")
 * ```
 * H5 侧的调用契约见同目录 `WebView语音桥接.md`。
 *
 * 三条硬性约束：
 *  1. SpeechRecognizer 只能在主线程创建和调用；
 *  2. 回调 JS 必须 `webView.post { }` 回到 UI 线程，否则直接崩；
 *  3. 识别结果拼进 JS 字符串前必须转义，用 `JSONObject.quote`。
 */
class AgentVoiceBridge(
    private val activity: Activity,
    private val webView: WebView
) : RecognitionListener, TextToSpeech.OnInitListener {

    companion object {
        private const val REQUEST_RECORD_AUDIO = 0x51
    }

    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null

    private var ttsReady = false
    /** TTS 初始化是异步的，就绪前来的播报请求先存着 */
    private var pendingSpeak: Pair<String, String>? = null

    /** 权限通过后要执行的动作 */
    private var pendingStart: String? = null

    init {
        // 构造时就把 TTS 初始化起来，等用户第一次点播报时通常已经就绪
        tts = TextToSpeech(activity, this)
    }

    // ------------------------------------------------------------ JS 接口

    @JavascriptInterface
    fun startVoice(payload: String) {
        val lang = runCatching { JSONObject(payload).optString("lang", "zh-CN") }.getOrDefault("zh-CN")

        activity.runOnUiThread {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED
            ) {
                pendingStart = lang
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    REQUEST_RECORD_AUDIO
                )
                return@runOnUiThread
            }
            startRecognizer(lang)
        }
    }

    @JavascriptInterface
    fun stopVoice() {
        activity.runOnUiThread {
            recognizer?.stopListening()
            emit("onEnd")
        }
    }

    @JavascriptInterface
    fun speak(text: String, lang: String) {
        activity.runOnUiThread {
            if (!ttsReady) {
                // 还没初始化完，先记下来，onInit 回调里补发
                pendingSpeak = text to lang
                return@runOnUiThread
            }
            applyTtsLanguage(lang)
            emit("onSpeakStart")
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "agent-${System.currentTimeMillis()}")
        }
    }

    @JavascriptInterface
    fun stopSpeak() {
        activity.runOnUiThread {
            tts?.stop()
            emit("onSpeakEnd")
        }
    }

    // ------------------------------------------------------------ 权限回调

    /** 在 Activity 的 onRequestPermissionsResult 里调用。 */
    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != REQUEST_RECORD_AUDIO) return
        val lang = pendingStart
        pendingStart = null

        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (lang != null) startRecognizer(lang)
        } else {
            emit("onError", "permission", "Microphone permission denied")
            emit("onEnd")
        }
    }

    // ------------------------------------------------------------ 识别

    private fun startRecognizer(lang: String) {
        // 每次重建，避免上一轮的状态残留
        recognizer?.destroy()
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            emit("onError", "unsupported", "SpeechRecognizer is not available on this device")
            emit("onEnd")
            return
        }

        recognizer = SpeechRecognizer.createSpeechRecognizer(activity).apply {
            setRecognitionListener(this@AgentVoiceBridge)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.packageName)
        }
        recognizer?.startListening(intent)
    }

    override fun onReadyForSpeech(params: Bundle?) = emit("onStart")

    override fun onBeginningOfSpeech() = Unit

    override fun onRmsChanged(rmsdB: Float) = Unit

    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() = Unit

    override fun onPartialResults(partialResults: Bundle?) {
        val text = partialResults
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()
        if (!text.isNullOrBlank()) emit("onPartial", text)
    }

    override fun onResults(results: Bundle?) {
        val text = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()
            .orEmpty()
        if (text.isNotBlank()) emit("onResult", text, true)
        // 部分机型不会自己释放麦克风，手动收尾
        recognizer?.stopListening()
        emit("onEnd")
    }

    override fun onError(error: Int) {
        emit("onError", mapError(error), "SpeechRecognizer error $error")
        emit("onEnd")
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    private fun mapError(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission"
        SpeechRecognizer.ERROR_NO_MATCH,
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
        SpeechRecognizer.ERROR_NETWORK,
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
        else -> "unknown"
    }

    // ------------------------------------------------------------ 播报

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (!ttsReady) return

        pendingSpeak?.let { (text, lang) ->
            pendingSpeak = null
            speak(text, lang)
        }
    }

    private fun applyTtsLanguage(lang: String) {
        val locale = Locale.forLanguageTag(lang)
        val result = tts?.setLanguage(locale)
        // 设备没装该语言的语音包时不要静默失败，交给 H5 提示用户
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            emit("onError", "unknown", "TTS language not supported: $lang")
        }
    }

    // ------------------------------------------------------------ 回调 JS

    /**
     * 派发到 H5 的 `window.__agentVoice.*`。
     *
     * 必须回到 UI 线程；字符串统一 `JSONObject.quote` 转义，
     * 否则识别结果里的引号会把整段 JS 拼坏。
     */
    private fun emit(name: String, vararg args: Any) {
        val payload = args.joinToString(",") { arg ->
            when (arg) {
                is Number, is Boolean -> arg.toString()
                else -> JSONObject.quote(arg.toString())
            }
        }
        webView.post {
            webView.evaluateJavascript("window.__agentVoice && window.__agentVoice.$name($payload)", null)
        }
    }

    // ------------------------------------------------------------ 释放

    /** 在 Activity 的 onDestroy 里调用，否则会泄漏 RecognitionService 连接。 */
    fun destroy() {
        recognizer?.destroy()
        recognizer = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
    }
}
