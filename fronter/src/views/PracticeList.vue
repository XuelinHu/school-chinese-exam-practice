<template>
  <section>
    <h1>{{ t('practice') }}</h1>
    <div class="grid">
      <router-link v-for="paper in papers" :key="paper.id" class="card" :to="`/practice/${paper.id}`">
        <h3>{{ paper.title }}</h3>
        <p class="muted">{{ paper.description }}</p>
        <div class="row">
          <span class="pill">{{ paper.level_name }}</span>
          <span class="pill">{{ t('questionCount') }}: {{ paper.question_count }}</span>
          <span class="pill">{{ t('score') }}: {{ paper.total_score }}</span>
        </div>
      </router-link>
    </div>
    <p v-if="!papers.length" class="muted">{{ t('empty') }}</p>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { request } from '../api/client.js';
import { state, t } from '../i18n/index.js';

const papers = ref([]);
async function load() {
  papers.value = await request(`/learning/papers?lang=${state.lang}`);
}
onMounted(load);
watch(() => state.lang, load);
</script>
