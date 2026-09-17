<template>
  <section class="admin-panel">
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" :placeholder="t('username')" />
      </label>
      <label>
        {{ t('action') }}
        <select v-model="query.action">
          <option value="">{{ t('all') }}</option>
          <option v-for="item in ACTIONS" :key="item" :value="item">{{ label(item) }}</option>
        </select>
      </label>
      <label>
        {{ t('result') }}
        <select v-model="query.success">
          <option value="">{{ t('all') }}</option>
          <option value="true">{{ label('ok') }}</option>
          <option value="false">{{ label('error') }}</option>
        </select>
      </label>
      <!-- 一个标签挂起止两个日期，避免为「起/止」再造文案 -->
      <label>
        {{ t('createdAt') }}
        <span class="row">
          <input v-model="query.dateFrom" type="date" />
          <span class="muted">–</span>
          <input v-model="query.dateTo" type="date" />
        </span>
      </label>
      <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
    </div>

    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>

    <div class="table-wrap" style="margin-top: 12px">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('name') }}</th>
            <th>{{ t('action') }}</th>
            <th>{{ t('result') }}</th>
            <th>{{ t('ip') }}</th>
            <th>{{ t('messages') }}</th>
            <th>{{ t('createdAt') }}</th>
            <th>{{ t('type') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.username }}</td>
            <td>{{ row.user_name }}</td>
            <td>{{ label(row.action) }}</td>
            <td>
              <span class="pill" :style="row.success ? PILL_OK : PILL_FAIL">
                {{ row.success ? label('ok') : label('error') }}
              </span>
            </td>
            <td>{{ row.ip }}</td>
            <td>{{ row.message }}</td>
            <td>{{ fmtTime(row.created_at) }}</td>
            <td class="wrap" :title="row.user_agent">{{ truncate(row.user_agent, 60) }}</td>
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
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import { t, label } from '../../i18n/index.js';

// 与后端 LOGIN_ACTIONS 白名单一致
const ACTIONS = ['login', 'logout', 'register', 'change_password', 'reset_password'];

// 成功/失败两种底色，直接内联，避免为一个徽标再加样式
const PILL_OK = { background: '#e7f7ee', color: '#1c7a45' };
const PILL_FAIL = { background: '#fdecec', color: '#a92f2f' };

const { rows, total, totalPages, loading, error, query, page, size, reset, changePage, changePageSize } =
  usePagedTable('/admin/login-logs', {
    filters: { keyword: '', action: '', success: '', dateFrom: '', dateTo: '' }
  });

const pad = (n) => String(n).padStart(2, '0');

/** 后端时间列 JSON 化后是 ISO(UTC) 串，这里按本地时区显示到分钟。 */
function fmtTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** UA 整串太长会把表格撑爆，裁掉后完整内容挂在 title 上。 */
function truncate(value, max = 60) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
</script>
