<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link class="brand" to="/">{{ t('app') }}</router-link>
      <nav class="toolbar">
        <router-link to="/">{{ t('home') }}</router-link>
        <router-link v-if="auth.user" to="/practice">{{ t('practice') }}</router-link>
        <router-link v-if="auth.user" to="/records">{{ t('records') }}</router-link>
        <router-link v-if="auth.user" to="/wrong-book">{{ t('wrongBook') }}</router-link>
        <router-link v-if="auth.user" to="/profile">{{ t('profile') }}</router-link>
        <router-link v-if="auth.user?.role === 'admin'" to="/admin">{{ t('dashboard') }}</router-link>
        <router-link v-if="!auth.user" to="/login">{{ t('login') }}</router-link>
        <button v-if="auth.user" @click="logout">{{ t('logout') }}</button>
        <select :value="state.lang" @change="setLang($event.target.value)">
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
          <option value="ms-MY">Bahasa Melayu</option>
        </select>
      </nav>
    </header>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { authStore as auth } from './stores/auth.js';
import { state, t, setLang } from './i18n/index.js';

const router = useRouter();
function logout() {
  auth.logout();
  router.push('/login');
}
</script>
