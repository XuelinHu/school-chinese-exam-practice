<template>
  <section>
    <h1>{{ t('records') }}</h1>
    <div class="card" style="overflow:auto">
      <table>
        <thead>
          <tr>
            <th>{{ t('title') }}</th>
            <th>{{ t('questionCount') }}</th>
            <th>{{ t('correct') }}</th>
            <th>{{ t('wrong') }}</th>
            <th>{{ t('score') }}</th>
            <th>{{ t('submittedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.paper_title }}</td>
            <td>{{ row.total_questions }}</td>
            <td>{{ row.correct_count }}</td>
            <td>{{ row.wrong_count }}</td>
            <td>{{ row.total_score }}</td>
            <td>{{ row.submitted_at }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="muted">{{ t('empty') }}</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { request } from '../api/client.js';
import { state, t } from '../i18n/index.js';

const rows = ref([]);
async function load() {
  rows.value = await request(`/learning/records?lang=${state.lang}`);
}
onMounted(load);
watch(() => state.lang, load);
</script>
