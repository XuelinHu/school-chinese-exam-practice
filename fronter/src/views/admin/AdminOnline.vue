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
        <p class="k">{{ t('admin') }}</p>
        <p class="v">{{ summary.admins }}</p>
      </div>
    </div>
    <p class="hint">{{ t('windowMinutes') }}: {{ windowMinutes }}</p>

    <div class="filters" style="margin-top: 12px">
      <label>
        {{ t('windowMinutes') }}
        <select v-model.number="query.minutes" @change="search">
          <option v-for="option in MINUTE_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <label>
        {{ t('role') }}
        <select v-model="query.role" @change="search">
          <option value="">{{ t('all') }}</option>
          <option value="student">{{ label('student') }}</option>
          <option value="admin">{{ label('admin') }}</option>
        </select>
      </label>
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" :placeholder="t('username')" @input="onKeyword" />
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
import { onMounted, reactive, ref } from 'vue';
import { request, qs } from '../../api/client.js';
import Pagination from '../../components/Pagination.vue';
import { t, label } from '../../i18n/index.js';

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

/**
 * 这里不用 usePagedTable：接口在分页信封外还带了 `summary` 与 `windowMinutes`，
 * 公共组合式只保留 list/total/totalPages。
 */
const query = reactive({ minutes: DEFAULT_MINUTES, keyword: '', role: '' });
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const size = ref(10);
const loading = ref(false);
const error = ref('');
const windowMinutes = ref(DEFAULT_MINUTES);
const summary = reactive({ total: 0, students: 0, admins: 0 });

const pad = (n) => String(n).padStart(2, '0');

/** 后端时间列 JSON 化后是 ISO(UTC) 串，这里按本地时区显示到分钟。 */
function fmtTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request(`/admin/online${qs({ ...query, page: page.value, pageSize: size.value })}`);
    rows.value = data?.list ?? [];
    total.value = data?.total ?? 0;
    totalPages.value = data?.totalPages ?? 1;
    windowMinutes.value = data?.windowMinutes ?? query.minutes;
    // SUM 在无数据时是 NULL、且可能以字符串下发，统一转成数字
    summary.total = Number(data?.summary?.total) || 0;
    summary.students = Number(data?.summary?.students) || 0;
    summary.admins = Number(data?.summary?.admins) || 0;
    // 删到最后一页空了就自动回退一页，避免停在空白页
    if (!rows.value.length && page.value > 1 && total.value > 0) {
      page.value = Math.max(1, page.value - 1);
      return load();
    }
  } catch (err) {
    error.value = err.message || t('empty');
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  return load();
}

/** 关键词输入防抖，避免每敲一个字母打一次库。 */
let timer = null;
function onKeyword() {
  clearTimeout(timer);
  timer = setTimeout(search, 350);
}

function resetFilters() {
  query.minutes = DEFAULT_MINUTES;
  query.role = '';
  query.keyword = '';
  return search();
}

function changePage(next) {
  page.value = Math.max(1, Math.min(next, totalPages.value || 1));
  return load();
}

function changePageSize(next) {
  size.value = Number(next) || 10;
  page.value = 1;
  return load();
}

onMounted(load);
</script>
