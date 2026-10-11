<template>
  <section class="card auth-card">
    <h2>{{ t('login') }}</h2>

    <p v-if="error" class="alert error">{{ error }}</p>

    <form class="form" @submit.prevent="submit">
      <label>
        {{ t('username') }}
        <input v-model.trim="form.username" autocomplete="username" required />
      </label>
      <label>
        {{ t('password') }}
        <input v-model="form.password" type="password" autocomplete="current-password" required />
      </label>

      <label class="row auth-remember">
        <input v-model="remember" type="checkbox" />
        <span>{{ t('rememberMe') }}</span>
      </label>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? t('loading') : t('login') }}
      </button>
    </form>

    <button class="btn secondary oidc-login" type="button" :disabled="loading" @click="startOidcLogin">
      {{ t('unifiedLogin') }}
    </button>

    <div class="row auth-links">
      <router-link to="/forgot-password">{{ t('forgotPassword') }}</router-link>
      <router-link to="/register">{{ t('register') }}</router-link>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore as auth } from '../stores/auth.js';
import { t } from '../i18n/index.js';
import { beginOidcLogin } from '../auth/oidc.js';

const route = useRoute();
const router = useRouter();

const REMEMBER_KEY = 'rememberedUsername';
const form = reactive({ username: '', password: '' });
const remember = ref(true);
const loading = ref(false);
const error = ref('');

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) form.username = saved;
  error.value = localStorage.getItem('oidc-login-error') || '';
  localStorage.removeItem('oidc-login-error');
});

function startOidcLogin() {
  error.value = '';
  beginOidcLogin().catch((err) => { error.value = err.message; });
}

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.login({ ...form });
    if (remember.value) localStorage.setItem(REMEMBER_KEY, form.username);
    else localStorage.removeItem(REMEMBER_KEY);
    router.push(route.query.redirect || '/');
  } catch (err) {
    // 423 = 连续失败被锁定，给一条能指导下一步的提示
    error.value = err.status === 423 ? t('accountLocked') : err.message;
  } finally {
    loading.value = false;
  }
}
</script>
