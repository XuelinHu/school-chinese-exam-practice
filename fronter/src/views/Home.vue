<template>
  <section class="hero">
    <div>
      <h1>{{ t('app') }}</h1>
      <p class="muted">HSK, campus Chinese, trilingual question bank and practice records.</p>
    </div>
    <div class="grid">
      <router-link class="card" to="/practice">
        <h3>{{ t('practice') }}</h3>
        <p class="muted">HSK1 / HSK2 / Campus Chinese</p>
      </router-link>
      <router-link class="card" to="/wrong-book">
        <h3>{{ t('wrongBook') }}</h3>
        <p class="muted">Review mistakes and explanations</p>
      </router-link>
      <router-link class="card" to="/records">
        <h3>{{ t('records') }}</h3>
        <p class="muted">Track practice scores</p>
      </router-link>
      <router-link v-if="auth.user?.role === 'admin'" class="card" to="/admin">
        <h3>{{ t('dashboard') }}</h3>
        <p class="muted">Question bank and student records</p>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { t } from '../i18n/index.js';
import { authStore as auth } from '../stores/auth.js';
</script>
