<template>
  <div class="pager">
    <span class="muted">{{ t('total', { n: total }) }}</span>

    <label class="pager-size">
      {{ t('pageSize') }}
      <select :value="pageSize" @change="$emit('size', Number($event.target.value))">
        <option v-for="option in sizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>

    <div class="pager-nav">
      <button class="btn ghost" :disabled="page <= 1 || loading" @click="$emit('page', page - 1)">
        {{ t('prev') }}
      </button>
      <span class="pager-now">{{ page }} / {{ totalPages }}</span>
      <button class="btn ghost" :disabled="page >= totalPages || loading" @click="$emit('page', page + 1)">
        {{ t('nextPage') }}
      </button>
    </div>

    <label v-if="totalPages > 7" class="pager-jump">
      {{ t('jumpTo') }}
      <input
        type="number"
        min="1"
        :max="totalPages"
        :value="page"
        @keyup.enter="jump($event.target.value)"
        @blur="jump($event.target.value)"
      />
    </label>
  </div>
</template>

<script setup>
import { t } from '../i18n/index.js';

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  loading: { type: Boolean, default: false },
  sizeOptions: { type: Array, default: () => [10, 20, 50, 100] }
});

const emit = defineEmits(['page', 'size']);

function jump(value) {
  const next = Number.parseInt(value, 10);
  if (Number.isInteger(next) && next >= 1 && next <= props.totalPages && next !== props.page) {
    emit('page', next);
  }
}
</script>
