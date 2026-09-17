<template>
  <div class="admin" :class="{ 'admin-open': drawerOpen }">
    <aside class="admin-side">
      <div class="admin-side-head">
        <router-link to="/" class="admin-brand">{{ t('admin') }}</router-link>
        <button class="admin-drawer-btn" type="button" @click="drawerOpen = !drawerOpen">
          {{ drawerOpen ? '×' : '☰' }}
        </button>
      </div>

      <nav class="admin-menu">
        <template v-for="group in MENU" :key="group.titleKey">
          <p class="admin-menu-title">{{ t(group.titleKey) }}</p>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="admin-menu-item"
            :class="{ active: isActive(item.path) }"
            @click="drawerOpen = false"
          >
            <span class="admin-menu-icon">{{ item.icon }}</span>
            <span>{{ t(item.titleKey) }}</span>
          </router-link>
        </template>
      </nav>

      <div class="admin-side-foot">
        <router-link to="/" class="admin-back">← {{ t('home') }}</router-link>
      </div>
    </aside>

    <div v-if="drawerOpen" class="admin-scrim" @click="drawerOpen = false" />

    <section class="admin-main">
      <header class="admin-head">
        <div>
          <h2>{{ t($route.meta.titleKey || 'admin') }}</h2>
          <p class="muted admin-crumb">
            {{ t('admin') }} <span>/</span> {{ t($route.meta.titleKey || 'admin') }}
          </p>
        </div>
        <div class="row">
          <span class="pill">{{ auth.user?.name || auth.user?.username }}</span>
          <button class="btn ghost" type="button" @click="logout">{{ t('logout') }}</button>
        </div>
      </header>

      <router-view v-slot="{ Component }">
        <keep-alive :max="4">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore as auth } from '../stores/auth.js';
import { t } from '../i18n/index.js';

const route = useRoute();
const router = useRouter();
const drawerOpen = ref(false);

/** 12 个菜单，与后端 `/api/admin/*` 一一对应。 */
const MENU = [
  {
    titleKey: 'dataBoard',
    items: [{ path: '/admin', icon: '▤', titleKey: 'dataBoard' }]
  },
  {
    titleKey: 'users',
    items: [
      { path: '/admin/students', icon: '☺', titleKey: 'users' },
      { path: '/admin/online', icon: '◉', titleKey: 'onlineStatus' },
      { path: '/admin/login-logs', icon: '⎙', titleKey: 'loginLogsMenu' }
    ]
  },
  {
    titleKey: 'questions',
    items: [
      { path: '/admin/questions', icon: '✎', titleKey: 'questions' },
      { path: '/admin/papers', icon: '▦', titleKey: 'papers' },
      { path: '/admin/levels', icon: '⬒', titleKey: 'levels' },
      { path: '/admin/categories', icon: '◈', titleKey: 'categories' },
      { path: '/admin/records', icon: '✓', titleKey: 'adminRecords' }
    ]
  },
  {
    titleKey: 'aiSettings',
    items: [
      { path: '/admin/ai/settings', icon: '⚙', titleKey: 'aiSettings' },
      { path: '/admin/ai/sessions', icon: '❝', titleKey: 'aiSessions' },
      { path: '/admin/ai/logs', icon: '◷', titleKey: 'aiLogs' }
    ]
  }
];

function isActive(path) {
  return path === '/admin' ? route.path === '/admin' : route.path.startsWith(path);
}

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>
