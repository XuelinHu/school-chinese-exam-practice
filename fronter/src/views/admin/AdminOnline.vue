<template>
  <section class="admin-panel">
    <div class="stat-grid">
      <div class="stat-card">
        <p class="k">{{ t('online') }}</p>
        <p class="v">{{ summary.total }}</p>
      </div>
      <div class="stat-card">
        <p class="k">{{ t('totalStudents') }}</p>
        <p class="v">{{ summary.students }}</p>
      </div>
      <div class="stat-card">
        <p class="k">{{ t('teachers') }}</p>
        <p class="v">{{ summary.teachers }}</p>
      </div>
      <div class="stat-card">
        <p class="k">{{ t('staff') }}</p>
        <p class="v">{{ summary.staff }}</p>
      </div>
    </div>
    <p class="hint">{{ t('windowMinutes') }}: {{ windowMinutes }}</p>

    <div class="filters" style="margin-top: 12px">
      <label>
        {{ t('windowMinutes') }}
        <select v-model.number="query.minutes">
          <option v-for="option in MINUTE_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <label>
        {{ t('role') }}
        <select v-model="query.role">
          <option value="">{{ t('all') }}</option>
          <option v-for="role in ROLES" :key="role" :value="role">{{ label(role) }}</option>
        </select>
      </label>
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" :placeholder="t('username')" />
      </label>
      <button class="btn ghost" type="button" @click="resetFilters">{{ t('reset') }}</button>
    </div>

    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>

    <div class="table-wrap" style="margin-top: 12px">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('name') }}</th>
            <th>{{ t('role') }}</th>
            <th>{{ t('language') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('lastActive') }}</th>
            <th>{{ t('lastLogin') }}</th>
            <th>{{ t('loginCount') }}</th>
            <th>{{ t('idleMinutes') }}</th>
            <th>{{ t('onlineStatus') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.username }}</td>
            <td>{{ row.name }}</td>
            <td>{{ label(row.role) }}</td>
            <td>{{ row.language }}</td>
            <td><span class="pill">{{ label(row.status) }}</span></td>
            <td>{{ fmtTime(row.last_active_at) }}</td>
            <td>{{ fmtTime(row.last_login_at) }}</td>
            <td>{{ row.login_count }}</td>
            <td>{{ row.idle_minutes }}</td>
            <td>
              <span class="pill" :style="ONLINE_PILL">
                <i :style="ONLINE_DOT"></i>{{ t('online') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
    </div>

    <Pagination
      style="margin-top: 12px"
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import { t, label } from '../../i18n/index.js';
import { fmtTime } from '../../utils/format.js';

// 与后端 users.role 的 ENUM 一致
const ROLES = ['student', 'teacher', 'content_admin', 'admin'];

// 与后端 onlineMinutes 白名单一致
const MINUTE_OPTIONS = [5, 15, 30, 60, 120];
const DEFAULT_MINUTES = 5;

// 在线徽标：绿点 + 绿底，直接内联，不为一个徽标另加样式
const ONLINE_PILL = { background: '#e7f7ee', color: '#1c7a45' };
const ONLINE_DOT = {
  display: 'inline-block',
  width: '7px',
  height: '7px',
  marginRight: '6px',
  borderRadius: '50%',
  background: '#22a06b'
};

const windowMinutes = ref(DEFAULT_MINUTES);
const summary = reactive({ total: 0, students: 0, teachers: 0, staff: 0 });

/**
 * 在线接口在分页信封外还带 `summary` / `windowMinutes`，
 * 用 `onLoaded` 接出来 —— 这样本页和其他 9 个菜单走同一套分页实现。
 */
const { rows, total, totalPages, loading, error, query, page, size, search, reset, changePage, changePageSize } =
  usePagedTable('/admin/online', {
    filters: { minutes: DEFAULT_MINUTES, keyword: '', role: '' },
    onLoaded(data) {
      windowMinutes.value = data.windowMinutes ?? query.minutes;
      // SUM 在无数据时是 NULL、且可能以字符串下发，统一转成数字
      summary.total = Number(data.summary?.total) || 0;
      summary.students = Number(data.summary?.students) || 0;
      summary.teachers = Number(data.summary?.teachers) || 0;
      summary.staff = Number(data.summary?.staff) || 0;
    }
  });

function resetFilters() {
  return reset();
}
</script>
