<template>
  <section v-if="paper">
    <div class="row">
      <h1>{{ paper.title }}</h1>
      <span class="pill">{{ index + 1 }} / {{ paper.questions.length }}</span>
    </div>
    <div v-if="!result" class="split">
      <div class="card">
        <p class="muted">{{ current.category_name }} · {{ current.difficulty }}</p>
        <h3>{{ current.title }}</h3>
        <p>{{ current.content }}</p>
        <button
          v-for="option in current.options"
          :key="option.id"
          class="option"
          :class="{ active: selectedIds.includes(option.id) }"
          @click="select(option.id)"
        >
          {{ option.option_key }}. {{ option.content }}
        </button>
        <div class="row">
          <button class="btn ghost" :disabled="index === 0" @click="index -= 1">‹</button>
          <button v-if="index < paper.questions.length - 1" class="btn" @click="index += 1">{{ t('next') }}</button>
          <button v-else class="btn" @click="submit">{{ t('submit') }}</button>
        </div>
        <p class="muted">{{ message }}</p>
      </div>
      <aside class="card">
        <h4>{{ t('questionCount') }}</h4>
        <div class="row">
          <button v-for="(q, i) in paper.questions" :key="q.id" class="btn ghost" @click="index = i">
            {{ i + 1 }}
          </button>
        </div>
      </aside>
    </div>
    <div v-else class="card">
      <h2>{{ t('result') }}</h2>
      <div class="grid">
        <div><strong>{{ result.correct_count }}</strong><p>{{ t('correct') }}</p></div>
        <div><strong>{{ result.wrong_count }}</strong><p>{{ t('wrong') }}</p></div>
        <div><strong>{{ result.total_score }}</strong><p>{{ t('score') }}</p></div>
      </div>
      <div v-for="question in paper.questions" :key="question.id" class="card">
        <h4>{{ question.title }}</h4>
        <p class="muted">{{ question.analysis }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { request } from '../api/client.js';
import { state, t } from '../i18n/index.js';

const route = useRoute();
const paper = ref(null);
const index = ref(0);
const result = ref(null);
const message = ref('');
const answers = reactive({});
const startedAt = Date.now();
const current = computed(() => paper.value?.questions[index.value] || {});
const selectedIds = computed(() => answers[current.value.id] || []);

async function load() {
  paper.value = await request(`/learning/papers/${route.params.id}?lang=${state.lang}`);
  index.value = 0;
  result.value = null;
}
function select(optionId) {
  answers[current.value.id] = [optionId];
  message.value = '';
}
async function submit() {
  const payload = paper.value.questions.map((question) => ({ question_id: question.id, selected_option_ids: answers[question.id] || [] }));
  if (payload.some((item) => item.selected_option_ids.length === 0)) {
    message.value = t('chooseAnswer');
    return;
  }
  result.value = await request(`/learning/papers/${paper.value.id}/submit`, {
    method: 'POST',
    body: { answers: payload, duration_seconds: Math.round((Date.now() - startedAt) / 1000), language: state.lang }
  });
}
onMounted(load);
watch(() => state.lang, load);
</script>
