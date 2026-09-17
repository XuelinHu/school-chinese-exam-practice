<template>
  <div class="agent-models">
    <label class="agent-models-row">
      <span class="muted">{{ t('model') }}</span>
      <select :value="model" :disabled="loading" @change="$emit('update:model', $event.target.value)">
        <option v-for="item in models" :key="item.name" :value="item.name">
          {{ item.name }}{{ item.loaded ? ` · ${t('loaded')}` : '' }}
        </option>
      </select>
    </label>

    <div class="agent-models-actions">
      <button
        class="btn ghost btn-sm"
        type="button"
        :disabled="loading || !model || currentLoaded"
        @click="load"
      >
        {{ t('loadModel') }}
      </button>
      <button
        class="btn ghost btn-sm"
        type="button"
        :disabled="loading || !model || !currentLoaded"
        @click="unload"
      >
        {{ t('unloadModel') }}
      </button>
      <button class="btn ghost btn-sm" type="button" :disabled="loading" @click="refresh">
        {{ t('refreshModels') }}
      </button>
    </div>

    <p v-if="loading" class="agent-note muted">{{ t('loading') }} · {{ t('modelColdStart') }}</p>
    <p v-else-if="notice" class="agent-note">{{ notice }}</p>
    <p v-if="error" class="agent-note error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { models as fetchModels, loadModel, unloadModel } from '../../api/ai.js';
import { t } from '../../i18n/index.js';

const props = defineProps({
  model: { type: String, default: '' }
});

const emit = defineEmits(['update:model']);

const list = ref([]);
const running = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');

const models = computed(() =>
  list.value.map((item) => ({ ...item, loaded: running.value.some((row) => row.name === item.name) }))
);
const currentLoaded = computed(() => models.value.find((item) => item.name === props.model)?.loaded ?? false);

async function refresh() {
  loading.value = true;
  error.value = '';
  notice.value = '';
  try {
    const data = await fetchModels({ refresh: true });
    list.value = data.models || [];
    running.value = data.running || [];
    // 首次进入时把默认模型选上，省得用户手动挑。
    // 后端未显式配置时会返回推荐模型；万一那个名字不在列表里（模型被删了等），
    // 退回列表首项，至少保证选中的是真实存在的模型。
    if (!props.model && list.value.length) {
      const known = data.defaultModel && list.value.some((item) => item.name === data.defaultModel);
      emit('update:model', known ? data.defaultModel : list.value[0].name);
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

/**
 * 冷加载实测约 20 秒（qwen3:14b 9.28GB），期间必须给出明确反馈，
 * 否则用户会以为页面卡死了。
 */
async function load() {
  loading.value = true;
  error.value = '';
  notice.value = t('modelColdStart');
  try {
    await loadModel(props.model);
    await refresh();
    notice.value = '';
  } catch (err) {
    error.value = err.message;
    notice.value = '';
  } finally {
    loading.value = false;
  }
}

async function unload() {
  loading.value = true;
  error.value = '';
  try {
    await unloadModel(props.model);
    await refresh();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

defineExpose({ refresh });
</script>
