<template>
  <div class="app-shell" :class="{ 'app-shell-wide': isAdminRoute }">
    <header class="topbar">
      <router-link class="brand" to="/">{{ t('app') }}</router-link>
      <nav class="toolbar">
        <router-link to="/">{{ t('home') }}</router-link>
        <router-link v-if="auth.user" to="/practice">{{ t('practice') }}</router-link>
        <router-link v-if="auth.user" to="/records">{{ t('records') }}</router-link>
        <router-link v-if="auth.user" to="/wrong-book">{{ t('wrongBook') }}</router-link>
        <router-link v-if="auth.user" to="/profile">{{ t('profile') }}</router-link>
        <router-link v-if="auth.isAdmin" to="/admin">{{ t('dashboard') }}</router-link>
        <router-link v-if="!auth.user" to="/login">{{ t('login') }}</router-link>
        <router-link v-if="!auth.user" to="/register">{{ t('register') }}</router-link>
        <button v-if="auth.user" @click="logout">{{ t('logout') }}</button>
        <select :value="state.lang" @change="changeLang($event.target.value)">
          <option v-for="item in LANGUAGES" :key="item.code" :value="item.code">{{ item.label }}</option>
        </select>
      </nav>
    </header>
    <main class="content">
      <router-view />
    </main>

    <!-- 登录后才挂智能体，避免在登录页就发起带鉴权的请求 -->
    <AgentWidget v-if="auth.user" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AgentWidget from './components/agent/AgentWidget.vue';
import { authStore as auth } from './stores/auth.js';
import { state, t, setLang, LANGUAGES } from './i18n/index.js';
import { request } from './api/client.js';

const route = useRoute();
const router = useRouter();

const isAdminRoute = computed(() => route.path.startsWith('/admin'));

async function logout() {
  await auth.logout();
  router.push('/login');
}

/** 语言偏好同时落到账号上，换设备登录也保持一致。 */
async function changeLang(lang) {
  setLang(lang);
  if (!auth.user) return;
  auth.user = { ...auth.user, language: lang };
  localStorage.setItem('user', JSON.stringify(auth.user));
  await request('/auth/profile', { method: 'PUT', body: { language: lang } }).catch(() => {});
}

onMounted(() => {
  // 本地缓存的 user 可能是旧的（头像/角色变了），启动时和服务端对齐一次
  auth.refresh();
});
</script>
