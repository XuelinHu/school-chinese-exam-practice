<template>
  <section class="admin-panel" style="display:grid;gap:14px">
    <!-- 筛选：关键词（用户名/错误文本）+ 模型 + 场景 + 状态 -->
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" type="text" :placeholder="t('username')" />
      </label>
      <label>
        {{ t('model') }}
        <input v-model="query.model" type="text" :placeholder="t('model')" />
      </label>
      <label>
        {{ t('type') }}
        <select v-model="query.scene">
          <option value="">{{ t('all') }}</option>
          <option value="student">{{ label('student') }}</option>
          <option value="admin">{{ label('admin') }}</option>
        </select>
      </label>
      <label>
        {{ t('status') }}
        <select v-model="query.status">
          <option value="">{{ t('all') }}</option>
          <option value="ok">{{ label('ok') }}</option>
          <option value="error">{{ label('error') }}</option>
        </select>
      </label>
      <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
    </div>

    <p v-if="error" class="alert error">{{ error }}</p>

    <!-- 当前页汇总：平均耗时 / 失败条数 -->
    <div class="stat-grid" style="max-width:420px">
      <div class="stat-card">
        <div class="k">{{ t('latency') }}</div>
        <div class="v">{{ averageLatency }}</div>
      </div>
      <div class="stat-card">
        <div class="k">{{ label('error') }}</div>
        <div class="v">{{ errorCount }}</div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('type') }}</th>
            <th>{{ t('model') }}</th>
            <th>{{ t('tools') }}</th>
            <th>{{ t('promptChars') }}</th>
            <th>{{ t('completionChars') }}</th>
            <th>{{ t('latency') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('createdAt') }}</th>
            <th>{{ label('error') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>
              {{ row.username }}
              <span v-if="row.user_name" class="muted">· {{ row.user_name }}</span>
            </td>
            <td><span class="pill">{{ label(row.scene) }}</span></td>
            <td>{{ row.model }}</td>
            <td>
              <template v-if="toolNames(row).length">
                <span v-for="name in toolNames(row)" :key="name" class="pill" style="margin-right:4px">{{ name }}</span>
              </template>
              <span v-else class="muted">{{ t('empty') }}</span>
            </td>
            <td>{{ row.prompt_chars }}</td>
            <td>{{ row.completion_chars }}</td>
            <td>{{ formatLatency(row.latency_ms) }}</td>
            <td><span class="pill" :style="statusStyle(row.status)">{{ label(row.status) }}</span></td>
            <td>{{ formatTime(row.created_at) }}</td>
            <td class="wrap">
              <span v-if="row.error" :title="row.error">{{ truncate(row.error) }}</span>
              <span v-else class="muted">{{ t('empty') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
    </div>

    <Pagination
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
import { computed } from 'vue';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import { t, label } from '../../i18n/index.js';

const { rows, total, totalPages, loading, error, query, page, size, changePage, changePageSize, reset } =
  usePagedTable('/admin/ai/logs', { filters: { keyword: '', model: '', scene: '', status: '' } });

/** 毫秒 → `1.2s` / `820ms`。 */
function formatLatency(ms) {
  const value = Number(ms) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

/** 当前页平均耗时，只统计有耗时的行；整页无数据时给个占位符。 */
const averageLatency = computed(() => {
  const values = rows.value.map((row) => Number(row.latency_ms)).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return '—';
  return formatLatency(values.reduce((sum, value) => sum + value, 0) / values.length);
});

/** 当前页失败条数。 */
const errorCount = computed(() => rows.value.filter((row) => row.status === 'error').length);

/** tool_names 是逗号串，拆成数组渲染成一排 pill。 */
function toolNames(row) {
  return String(row.tool_names || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** ok / error 两态复用现有 alert 配色，不新增 CSS。 */
function statusStyle(status) {
  return status === 'ok'
    ? { background: '#e7f7ee', color: '#1c7a45' }
    : { background: '#fdecec', color: '#a92f2f' };
}

/** 超长错误只留摘要，完整内容挂 title。 */
function truncate(text) {
  const value = String(text);
  return value.length > 60 ? `${value.slice(0, 60)}…` : value;
}

/** MySQL DATETIME 经 JSON 变成 ISO 串，按本地时间裁成 `YYYY-MM-DD HH:mm`。 */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
</script>
