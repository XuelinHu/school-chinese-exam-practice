<template>
  <section class="admin-panel" style="display:grid;gap:14px">
    <p v-if="loadError" class="alert error">{{ loadError }}</p>
    <p v-if="errorMessage" class="alert error">{{ errorMessage }}</p>
    <p v-if="notice" class="alert success">{{ notice }}</p>
    <p v-if="loading" class="muted">{{ t('loading') }}</p>

    <template v-else>
      <!-- 只读运行环境（host / keepAlive / timeoutMs / 是否启用） -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="k">{{ t('status') }}</div>
          <div class="v" style="font-size:16px">{{ label(env.enabled ? 'active' : 'disabled') }}</div>
        </div>
        <div class="stat-card">
          <div class="k">{{ t('serviceAddress') }}</div>
          <div class="v" style="font-size:16px;word-break:break-all">{{ env.host }}</div>
        </div>
        <div class="stat-card">
          <div class="k">{{ t('keepAlive') }}</div>
          <div class="v" style="font-size:16px">{{ env.keepAlive }}</div>
        </div>
        <div class="stat-card">
          <div class="k">{{ t('requestTimeout') }}</div>
          <div class="v" style="font-size:16px">{{ formatLatency(env.timeoutMs) }}</div>
        </div>
      </div>

      <!-- 模型：默认模型 + 加载 / 卸载 / 刷新 -->
      <div class="field">
        <span>{{ t('defaultModel') }}</span>
        <div class="row">
          <select v-model="form.defaultModel" style="flex:1 1 200px">
            <option v-for="item in availableModels" :key="item.name" :value="item.name">{{ modelLabel(item) }}</option>
          </select>
          <button class="btn" type="button" :disabled="!!busy || !form.defaultModel" @click="loadModel">
            {{ busy === 'load' ? t('loading') : t('loadModel') }}
          </button>
          <button class="btn ghost" type="button" :disabled="!!busy || !form.defaultModel" @click="unloadModel">
            {{ busy === 'unload' ? t('loading') : t('unloadModel') }}
          </button>
          <button class="btn ghost" type="button" :disabled="!!busy" @click="refreshModels">
            {{ busy === 'refresh' ? t('loading') : t('refreshModels') }}
          </button>
        </div>
        <p v-if="!availableModels.length" class="muted">{{ t('empty') }}</p>
      </div>

      <!-- 启用场景 -->
      <div class="field">
        <span>{{ t('enabledScenes') }}</span>
        <div class="row">
          <label v-for="scene in scenes" :key="scene.id" class="row" style="gap:6px">
            <input v-model="form.enabledScenes" type="checkbox" :value="scene.id" />
            <span>{{ label(scene.id) }}</span>
          </label>
        </div>
      </div>

      <!-- 欢迎语 -->
      <div class="form-grid">
        <label class="field full">
          {{ t('studentGreeting') }}
          <textarea v-model="form.studentGreeting" rows="3"></textarea>
        </label>
        <label class="field full">
          {{ t('adminGreeting') }}
          <textarea v-model="form.adminGreeting" rows="3"></textarea>
        </label>
      </div>

      <!-- 语音开关 -->
      <div class="row">
        <label class="row" style="gap:6px">
          <input v-model="form.voiceEnabled" type="checkbox" />
          <span>{{ t('voiceEnabled') }}</span>
        </label>
        <label class="row" style="gap:6px">
          <input v-model="form.voiceAutoSpeak" type="checkbox" />
          <span>{{ t('voiceAutoSpeak') }}</span>
        </label>
      </div>

      <!-- 工具轮次上限 / 上下文窗口 -->
      <div class="form-grid">
        <label class="field">
          {{ t('toolsLimit') }}
          <input v-model.number="form.maxToolRounds" type="number" min="1" max="10" />
        </label>
        <label class="field">
          {{ t('contextWindow') }}
          <input v-model.number="form.numCtx" type="number" min="512" max="131072" />
        </label>
      </div>

      <div class="row">
        <button class="btn" type="button" :disabled="saving" @click="save">
          {{ saving ? t('loading') : t('save') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { request } from '../../api/client.js';
import { t, label } from '../../i18n/index.js';

const loading = ref(true);
const loadError = ref('');
const errorMessage = ref('');
const notice = ref('');
const saving = ref(false);
/** 模型操作互斥：'' | 'load' | 'unload' | 'refresh'，加载模型可能要 20 秒。 */
const busy = ref('');

const availableModels = ref([]);
const scenes = ref([]);
const env = ref({});

const form = reactive({
  defaultModel: '',
  enabledScenes: [],
  studentGreeting: '',
  adminGreeting: '',
  voiceEnabled: true,
  voiceAutoSpeak: false,
  maxToolRounds: 4,
  numCtx: 16384
});

/** 选项文案：模型名 +（已加载）标记，供 select 展示。 */
function modelLabel(item) {
  return item.loaded ? `${item.name} · ${t('loaded')}` : item.name;
}

/** 毫秒 → `1.2s` / `820ms`。 */
function formatLatency(ms) {
  const value = Number(ms) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

/** 只同步只读信息，别覆盖管理员正在编辑的表单。 */
function applyReadonly(data) {
  availableModels.value = data.availableModels ?? [];
  scenes.value = data.scenes ?? [];
  env.value = data.env ?? {};
}

function fillForm(data) {
  form.defaultModel = data.defaultModel || '';
  form.enabledScenes = Array.isArray(data.enabledScenes) ? [...data.enabledScenes] : [];
  form.studentGreeting = data.studentGreeting || '';
  form.adminGreeting = data.adminGreeting || '';
  form.voiceEnabled = Boolean(data.voiceEnabled);
  form.voiceAutoSpeak = Boolean(data.voiceAutoSpeak);
  form.maxToolRounds = Number(data.maxToolRounds) || 1;
  form.numCtx = Number(data.numCtx) || 512;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await request('/admin/ai/settings');
    applyReadonly(data);
    fillForm(data);
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}

/** 重新拉一次设置里的只读部分（模型列表带 loaded 标记）。 */
async function syncReadonly() {
  applyReadonly(await request('/admin/ai/settings'));
}

/** 模型操作共用：清提示 → 执行 → 同步只读 → 反馈。 */
async function runModelAction(action, path, successKey) {
  busy.value = action;
  errorMessage.value = '';
  notice.value = '';
  try {
    await request(path, { method: 'POST', body: { model: form.defaultModel } });
    await syncReadonly();
    notice.value = successKey ? t(successKey) : '';
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    busy.value = '';
  }
}

// 加载/卸载挂在 /ai/models/*，不是 /admin/ai/*
function loadModel() {
  return runModelAction('load', '/ai/models/load', 'loaded');
}

function unloadModel() {
  return runModelAction('unload', '/ai/models/unload', 'notLoaded');
}

/** 刷新模型缓存：先让后端重新列模型，再拉回带 loaded 标记的列表。 */
async function refreshModels() {
  busy.value = 'refresh';
  errorMessage.value = '';
  notice.value = '';
  try {
    await request('/admin/ai/settings/refresh-models', { method: 'POST' });
    await syncReadonly();
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    busy.value = '';
  }
}

async function save() {
  saving.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const data = await request('/admin/ai/settings', {
      method: 'PUT',
      body: {
        defaultModel: form.defaultModel,
        enabledScenes: [...form.enabledScenes],
        studentGreeting: form.studentGreeting,
        adminGreeting: form.adminGreeting,
        voiceEnabled: form.voiceEnabled,
        voiceAutoSpeak: form.voiceAutoSpeak,
        maxToolRounds: Number(form.maxToolRounds),
        numCtx: Number(form.numCtx)
      }
    });
    // 以服务端回写的值为准，顺带把 '4' 这类字符串归一成数字
    fillForm(data);
    notice.value = t('saved');
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
