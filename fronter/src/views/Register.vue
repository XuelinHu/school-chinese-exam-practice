<template>
  <section class="card auth-card">
    <h2>{{ t('register') }}</h2>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="done" class="alert success">{{ t('registerSuccess') }}</p>

    <form class="form" @submit.prevent="submit">
      <label>
        {{ t('username') }}
        <input v-model.trim="form.username" autocomplete="username" required minlength="3" />
      </label>
      <label>
        {{ t('password') }}
        <input v-model="form.password" type="password" autocomplete="new-password" required minlength="8" />
        <span class="hint">{{ t('passwordRule') }}</span>
      </label>
      <label>
        {{ t('confirmPassword') }}
        <input v-model="form.confirmPassword" type="password" autocomplete="new-password" required />
      </label>

      <div class="form-grid">
        <label>
          {{ t('name') }}
          <input v-model.trim="form.name" />
        </label>
        <label>
          {{ t('email') }}
          <input v-model.trim="form.email" type="email" />
        </label>
        <label>
          {{ t('studentNo') }}
          <input v-model.trim="form.studentNo" />
        </label>
        <label>
          {{ t('nationality') }}
          <input v-model.trim="form.nationality" />
        </label>
        <label>
          {{ t('language') }}
          <select v-model="form.language">
            <option v-for="item in LANGUAGES" :key="item.code" :value="item.code">{{ item.label }}</option>
          </select>
        </label>
      </div>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? t('loading') : t('register') }}
      </button>
    </form>

    <div class="row auth-links">
      <router-link to="/login">{{ t('login') }}</router-link>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { authStore as auth } from '../stores/auth.js';
import { t, LANGUAGES, state as i18nState } from '../i18n/index.js';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const done = ref(false);

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  name: '',
  email: '',
  studentNo: '',
  nationality: '',
  language: i18nState.lang
});

async function submit() {
  error.value = '';
  if (form.password !== form.confirmPassword) {
    error.value = t('passwordMismatch');
    return;
  }

  loading.value = true;
  try {
    await auth.register({ ...form });
    done.value = true;
    setTimeout(() => router.push('/login'), 900);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>
