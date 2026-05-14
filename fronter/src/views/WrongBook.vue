<template>
  <section>
    <h1>{{ t('wrongBook') }}</h1>
    <div class="grid">
      <article v-for="row in rows" :key="row.id" class="card">
        <div class="row">
          <span class="pill">{{ row.category_name }}</span>
          <span class="pill">{{ t('wrong') }}: {{ row.wrong_count }}</span>
        </div>
        <h3>{{ row.title }}</h3>
        <p class="muted">{{ t('analysis') }}: {{ row.analysis }}</p>
      </article>
    </div>
    <p v-if="!rows.length" class="muted">{{ t('empty') }}</p>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { request } from '../api/client.js';
import { state, t } from '../i18n/index.js';

const rows = ref([]);
async function load() {
  rows.value = await request(`/learning/wrong-questions?lang=${state.lang}`);
}
onMounted(load);
watch(() => state.lang, load);
</script>
