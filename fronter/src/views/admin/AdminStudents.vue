<template>
  <section class="admin-panel">
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" :placeholder="t('username')" />
      </label>
      <label>
        {{ t('role') }}
        <select v-model="query.role">
          <option value="">{{ t('all') }}</option>
          <option value="student">{{ label('student') }}</option>
          <option value="admin">{{ label('admin') }}</option>
        </select>
      </label>
      <label>
        {{ t('status') }}
        <select v-model="query.status">
          <option value="">{{ t('all') }}</option>
          <option value="active">{{ label('active') }}</option>
          <option value="disabled">{{ label('disabled') }}</option>
        </select>
      </label>
      <label>
        {{ t('onlineStatus') }}
        <select v-model="query.online">
          <option value="">{{ t('all') }}</option>
          <option value="true">{{ t('online') }}</option>
        </select>
      </label>
      <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
    </div>

    <p v-if="notice" class="alert success" style="margin-top: 12px">{{ notice }}</p>
    <p v-if="actionError" class="alert error" style="margin-top: 12px">{{ actionError }}</p>
    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>

    <div class="table-wrap" style="margin-top: 12px">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('name') }}</th>
            <th>{{ t('role') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('onlineStatus') }}</th>
            <th>{{ t('totalRecords') }}</th>
            <th>{{ t('avgScore') }}</th>
            <th>{{ t('wrongBook') }}</th>
            <th>{{ t('lastActive') }}</th>
            <th>{{ t('lastLogin') }}</th>
            <th>{{ t('loginCount') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>
              <!-- 用户名即详情入口，省掉一个没有对应文案的按钮 -->
              <button class="btn ghost btn-sm" type="button" :title="t('profile')" @click="openDetail(row)">
                {{ row.username }}
              </button>
            </td>
            <td>{{ row.name }}</td>
            <td>{{ label(row.role) }}</td>
            <td><span class="pill">{{ label(row.status) }}</span></td>
            <td>{{ row.online ? t('online') : t('offline') }}</td>
            <td>{{ row.record_count }}</td>
            <td>{{ row.avg_score }}</td>
            <td>{{ row.unresolved_wrong }}</td>
            <td>{{ fmtTime(row.last_active_at) }}</td>
            <td>{{ fmtTime(row.last_login_at) }}</td>
            <td>{{ row.login_count }}</td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openEdit(row)">{{ t('edit') }}</button>
                <button class="btn ghost btn-sm" type="button" @click="resetPassword(row)">
                  {{ t('resetPassword') }}
                </button>
                <button v-if="row.locked_until" class="btn ghost btn-sm" type="button" @click="unlock(row)">
                  {{ t('unlock') }}
                </button>
                <button class="btn ghost danger btn-sm" type="button" @click="remove(row)">{{ t('delete') }}</button>
              </div>
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

    <!-- 编辑资料 -->
    <AppModal v-model="editOpen" :title="t('edit')">
      <div class="form-grid">
        <label>{{ t('name') }}<input v-model="form.name" /></label>
        <label>{{ t('email') }}<input v-model="form.email" type="email" /></label>
        <label>{{ t('phone') }}<input v-model="form.phone" /></label>
        <label>{{ t('studentNo') }}<input v-model="form.student_no" /></label>
        <label>{{ t('nationality') }}<input v-model="form.nationality" /></label>
        <label>
          {{ t('language') }}
          <select v-model="form.language">
            <option v-for="code in LANGUAGES" :key="code" :value="code">{{ code }}</option>
          </select>
        </label>
        <label>
          {{ t('role') }}
          <select v-model="form.role">
            <option value="student">{{ label('student') }}</option>
            <option value="admin">{{ label('admin') }}</option>
          </select>
        </label>
        <label>
          {{ t('status') }}
          <select v-model="form.status">
            <option value="active">{{ label('active') }}</option>
            <option value="disabled">{{ label('disabled') }}</option>
          </select>
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" type="button" @click="editOpen = false">{{ t('cancel') }}</button>
        <button class="btn" type="button" :disabled="saving" @click="saveEdit">{{ t('save') }}</button>
      </template>
    </AppModal>

    <!-- 学员详情（只读） -->
    <AppModal v-model="detailOpen" :title="detail.name || detail.username || t('users')">
      <p v-if="detailLoading" class="muted">{{ t('loading') }}</p>
      <template v-else>
        <div class="form-grid">
          <div class="field"><span class="muted">{{ t('username') }}</span><span>{{ detail.username }}</span></div>
          <div class="field"><span class="muted">{{ t('name') }}</span><span>{{ detail.name }}</span></div>
          <div class="field"><span class="muted">{{ t('email') }}</span><span>{{ detail.email }}</span></div>
          <div class="field"><span class="muted">{{ t('phone') }}</span><span>{{ detail.phone }}</span></div>
          <div class="field"><span class="muted">{{ t('studentNo') }}</span><span>{{ detail.student_no }}</span></div>
          <div class="field"><span class="muted">{{ t('nationality') }}</span><span>{{ detail.nationality }}</span></div>
          <div class="field"><span class="muted">{{ t('language') }}</span><span>{{ detail.language }}</span></div>
          <div class="field"><span class="muted">{{ t('role') }}</span><span>{{ label(detail.role) }}</span></div>
          <div class="field"><span class="muted">{{ t('status') }}</span><span>{{ label(detail.status) }}</span></div>
          <div class="field"><span class="muted">{{ t('createdAt') }}</span><span>{{ fmtTime(detail.created_at) }}</span></div>
        </div>

        <p class="hint">{{ t('records') }}</p>
        <div class="form-grid">
          <div class="field"><span class="muted">{{ t('totalRecords') }}</span><span>{{ stats.records ?? 0 }}</span></div>
          <div class="field"><span class="muted">{{ t('avgScore') }}</span><span>{{ stats.avg_score ?? 0 }}</span></div>
          <div class="field"><span class="muted">{{ t('wrong') }}</span><span>{{ stats.wrong ?? 0 }}</span></div>
          <div class="field"><span class="muted">{{ t('wrongBook') }}</span><span>{{ stats.unresolved_wrong ?? 0 }}</span></div>
          <div class="field"><span class="muted">{{ t('aiSessions') }}</span><span>{{ stats.ai_sessions ?? 0 }}</span></div>
        </div>
      </template>
      <template #footer>
        <button class="btn" type="button" @click="detailOpen = false">{{ t('close') }}</button>
      </template>
    </AppModal>

    <!-- 重置密码：明文只回传一次，拿到就弹出来让管理员抄走 -->
    <AppModal v-model="pwdOpen" :title="t('resetPassword')" size="sm">
      <p class="alert success">{{ t('resetSuccess') }}</p>
      <div class="form-grid" style="margin-top: 12px">
        <div class="field"><span class="muted">{{ t('username') }}</span><span>{{ pwd.username }}</span></div>
        <div class="field">
          <span class="muted">{{ t('password') }}</span>
          <input :value="pwd.password" readonly @focus="$event.target.select()" />
        </div>
      </div>
      <template #footer>
        <button class="btn" type="button" @click="pwdOpen = false">{{ t('close') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { request } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { t, label } from '../../i18n/index.js';

// 与后端 users.language 白名单一致
const LANGUAGES = ['zh-CN', 'en-US', 'ms-MY'];

const { rows, total, totalPages, loading, error, query, page, size, load, reset, changePage, changePageSize } =
  usePagedTable('/admin/users', {
    filters: { keyword: '', role: '', status: '', online: '' }
  });

const notice = ref('');
const actionError = ref('');
const saving = ref(false);

const editOpen = ref(false);
const form = reactive({
  id: null,
  name: '',
  email: '',
  phone: '',
  student_no: '',
  nationality: '',
  language: 'zh-CN',
  role: 'student',
  status: 'active'
});

const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref({});
const stats = ref({});

const pwdOpen = ref(false);
const pwd = reactive({ username: '', password: '' });

const pad = (n) => String(n).padStart(2, '0');

/** 后端时间列 JSON 化后是 ISO(UTC) 串，这里按本地时区显示到分钟。 */
function fmtTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 成功/失败只留一条横幅，避免旧提示残留误导。 */
function notify(message, isError = false) {
  notice.value = isError ? '' : message;
  actionError.value = isError ? message : '';
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    student_no: row.student_no ?? '',
    nationality: row.nationality ?? '',
    language: row.language || 'zh-CN',
    role: row.role || 'student',
    status: row.status || 'active'
  });
  editOpen.value = true;
}

async function saveEdit() {
  saving.value = true;
  try {
    await request(`/admin/users/${form.id}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        email: form.email,
        phone: form.phone,
        student_no: form.student_no,
        nationality: form.nationality,
        language: form.language,
        role: form.role,
        status: form.status
      }
    });
    editOpen.value = false;
    notify(t('saved'));
    await load();
  } catch (err) {
    notify(err.message || t('empty'), true);
  } finally {
    saving.value = false;
  }
}

async function openDetail(row) {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await request(`/admin/users/${row.id}`);
    detail.value = data ?? {};
    stats.value = data?.stats ?? {};
  } catch (err) {
    notify(err.message || t('empty'), true);
  } finally {
    detailLoading.value = false;
  }
}

/** 不传 newPassword，后端生成随机密码并只在响应里回传一次。 */
async function resetPassword(row) {
  try {
    const data = await request(`/admin/users/${row.id}/reset-password`, { method: 'POST', body: {} });
    if (data?.password) {
      pwd.username = data.username || row.username;
      pwd.password = data.password;
      pwdOpen.value = true;
    }
    notify(t('saved'));
    await load();
  } catch (err) {
    notify(err.message || t('empty'), true);
  }
}

async function unlock(row) {
  try {
    await request(`/admin/users/${row.id}/unlock`, { method: 'POST' });
    notify(t('saved'));
    await load();
  } catch (err) {
    notify(err.message || t('empty'), true);
  }
}

async function remove(row) {
  if (!confirm(t('deleteConfirm'))) return;
  try {
    await request(`/admin/users/${row.id}`, { method: 'DELETE' });
    notify(t('deleted'));
    await load();
  } catch (err) {
    notify(err.message || t('empty'), true);
  }
}
</script>
