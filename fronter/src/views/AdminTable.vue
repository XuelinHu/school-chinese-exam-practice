<template>
  <section>
    <h1>{{ title }}</h1>
    <div class="card" style="overflow:auto">
      <table>
        <thead>
          <tr>
            <th v-for="header in headers" :key="header">{{ label(header) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-for="header in headers" :key="header">{{ format(row[header]) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="muted">{{ t('empty') }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { request } from '../api/client.js';
import { state, t } from '../i18n/index.js';

const props = defineProps({ type: { type: String, required: true } });
const rows = ref([]);
const title = computed(() => t(props.type === 'records' ? 'adminRecords' : props.type));
const headerMap = {
  users: ['id', 'username', 'name', 'role', 'student_no', 'nationality', 'language', 'status'],
  questions: ['id', 'title', 'level_name', 'category_name', 'question_type', 'difficulty', 'score', 'status'],
  papers: ['id', 'title', 'paper_type', 'question_count', 'total_score', 'duration_minutes', 'status'],
  records: ['id', 'username', 'name', 'paper_title', 'total_questions', 'correct_count', 'wrong_count', 'total_score', 'submitted_at']
};
const labelMap = {
  id: 'ID',
  username: t('username'),
  name: t('name'),
  role: t('role'),
  student_no: t('studentNo'),
  nationality: t('nationality'),
  language: t('language'),
  status: t('status'),
  title: t('title'),
  level_name: t('level'),
  category_name: t('category'),
  question_type: 'Type',
  difficulty: t('difficulty'),
  score: t('score'),
  paper_type: 'Type',
  question_count: t('questionCount'),
  total_score: t('score'),
  duration_minutes: t('duration'),
  paper_title: t('title'),
  total_questions: t('questionCount'),
  correct_count: t('correct'),
  wrong_count: t('wrong'),
  submitted_at: t('submittedAt')
};
const headers = computed(() => headerMap[props.type] || ['id']);

function label(key) {
  return labelMap[key] || key;
}
function format(value) {
  if (value == null) return '';
  if (typeof value === 'string' && value.length > 80) return `${value.slice(0, 80)}...`;
  return value;
}
async function load() {
  rows.value = await request(`/admin/${props.type}?lang=${state.lang}`);
}
onMounted(load);
watch(() => [props.type, state.lang], load);
</script>
