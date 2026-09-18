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
        <template v-for="group in menu" :key="group.titleKey">
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
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore as auth } from '../stores/auth.js';
import { t } from '../i18n/index.js';

const route = useRoute();
const router = useRouter();
const drawerOpen = ref(false);

/**
 * 12 个菜单，与后端 `/api/admin/*` 一一对应。
 *
 * `superAdmin: true` = 仅超级管理员可见；内容管理员只看得到没有该标记的
 * 内容类菜单（题库 / 试卷 / 等级 / 分类）。
 *
 * **前端隐藏只是体验**：真正的权限边界是后端 `admin.js` 里那两道
 * `allow()` 关卡，直敲 URL 也拿不到数据。
 */
const MENU = [
  {
    titleKey: 'dataBoard',
    items: [{ path: '/admin', icon: '▤', titleKey: 'dataBoard', superAdmin: true }]
  },
  {
    titleKey: 'questions',
    items: [
      { path: '/admin/questions', icon: '✎', titleKey: 'questions' },
      { path: '/admin/papers', icon: '▦', titleKey: 'papers' },
      { path: '/admin/levels', icon: '⬒', titleKey: 'levels' },
      { path: '/admin/categories', icon: '◈', titleKey: 'categories' }
    ]
  },
  {
    titleKey: 'users',
    items: [
      { path: '/admin/students', icon: '☺', titleKey: 'users', superAdmin: true },
      // 成绩记录含学员个人数据，归到「用户」组而不是「题库」组，也只给超管
      { path: '/admin/records', icon: '✓', titleKey: 'adminRecords', superAdmin: true },
      { path: '/admin/online', icon: '◉', titleKey: 'onlineStatus', superAdmin: true },
      { path: '/admin/login-logs', icon: '⎙', titleKey: 'loginLogsMenu', superAdmin: true }
    ]
  },
  {
    titleKey: 'aiSettings',
    items: [
      { path: '/admin/ai/settings', icon: '⚙', titleKey: 'aiSettings', superAdmin: true },
      { path: '/admin/ai/sessions', icon: '❝', titleKey: 'aiSessions', superAdmin: true },
      { path: '/admin/ai/logs', icon: '◷', titleKey: 'aiLogs', superAdmin: true }
    ]
  }
];

/** 按角色过滤：内容管理员会丢掉整组超管菜单，剩下的组按原顺序渲染。 */
const menu = computed(() =>
  MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.superAdmin || auth.isSuperAdmin)
  })).filter((group) => group.items.length)
);

function isActive(path) {
  return path === '/admin' ? route.path === '/admin' : route.path.startsWith(path);
}

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>
