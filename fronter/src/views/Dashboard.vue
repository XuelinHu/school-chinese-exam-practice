<template>
  <section>
    <h1>{{ t('dashboard') }}</h1>
    <div class="grid">
      <div class="card"><h3>{{ stats.students }}</h3><p>{{ t('totalStudents') }}</p></div>
      <div class="card"><h3>{{ stats.questions }}</h3><p>{{ t('totalQuestions') }}</p></div>
      <div class="card"><h3>{{ stats.papers }}</h3><p>{{ t('totalPapers') }}</p></div>
      <div class="card"><h3>{{ stats.avgScore }}</h3><p>{{ t('avgScore') }}</p></div>
    </div>
    <div class="grid" style="margin-top:12px">
      <router-link class="card" to="/admin/users">{{ t('users') }}</router-link>
      <router-link class="card" to="/admin/questions">{{ t('questions') }}</router-link>
      <router-link class="card" to="/admin/papers">{{ t('papers') }}</router-link>
      <router-link class="card" to="/admin/records">{{ t('adminRecords') }}</router-link>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive } from 'vue';
import { request } from '../api/client.js';
import { t } from '../i18n/index.js';

const stats = reactive({ students: 0, questions: 0, papers: 0, records: 0, avgScore: 0 });
onMounted(async () => Object.assign(stats, await request('/admin/stats')));
</script>
