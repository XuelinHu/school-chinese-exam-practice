<template>
  <div class="profile">
    <!-- 头像 + 基本资料 -->
    <section class="card">
      <h3>{{ t('profile') }}</h3>

      <div class="profile-head">
        <img v-if="avatarUrl" class="avatar" :src="avatarUrl" :alt="user?.username" />
        <div v-else class="avatar avatar-empty">{{ initial }}</div>

        <div class="profile-head-body">
          <p class="profile-name">{{ user?.name || user?.username }}</p>
          <p class="muted">
            <span class="pill">{{ label(user?.role) }}</span>
            <span v-if="user?.student_no"> · {{ t('studentNo') }} {{ user.student_no }}</span>
          </p>
          <label class="btn ghost btn-sm profile-upload">
            {{ uploading ? t('loading') : t('uploadAvatar') }}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden @change="upload" />
          </label>
          <p class="hint">{{ t('avatarHint') }}</p>
        </div>
      </div>

      <p v-if="avatarError" class="alert error">{{ avatarError }}</p>

      <div class="form-grid">
        <label>{{ t('name') }}<input v-model.trim="form.name" /></label>
        <label>{{ t('email') }}<input v-model.trim="form.email" type="email" /></label>
        <label>{{ t('phone') }}<input v-model.trim="form.phone" /></label>
        <label>{{ t('studentNo') }}<input v-model.trim="form.studentNo" /></label>
        <label>{{ t('nationality') }}<input v-model.trim="form.nationality" /></label>
        <label>
          {{ t('language') }}
          <select v-model="form.language">
            <option v-for="item in LANGUAGES" :key="item.code" :value="item.code">{{ item.label }}</option>
          </select>
        </label>
      </div>

      <div class="row profile-actions">
        <button class="btn" type="button" :disabled="saving" @click="saveProfile">
          {{ saving ? t('loading') : t('save') }}
        </button>
        <span v-if="savedTip" class="alert success">{{ savedTip }}</span>
      </div>
    </section>

    <!-- 修改密码 -->
    <section class="card">
      <h3>{{ t('changePassword') }}</h3>
      <p v-if="pwError" class="alert error">{{ pwError }}</p>
      <form class="form" @submit.prevent="changePassword">
        <label>{{ t('oldPassword') }}<input v-model="pw.oldPassword" type="password" autocomplete="current-password" required /></label>
        <label>
          {{ t('newPassword') }}
          <input v-model="pw.newPassword" type="password" autocomplete="new-password" required minlength="8" />
          <span class="hint">{{ t('passwordRule') }}</span>
        </label>
        <label>{{ t('confirmPassword') }}<input v-model="pw.confirmPassword" type="password" autocomplete="new-password" required /></label>
        <button class="btn" type="submit" :disabled="pwSaving">{{ pwSaving ? t('loading') : t('changePassword') }}</button>
      </form>
    </section>

    <!-- 我的登录日志 -->
    <section class="card">
      <h3>{{ t('loginLogs') }}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('action') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('ip') }}</th>
              <th>{{ t('createdAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in logs.rows" :key="row.id">
              <td>{{ label(row.action) }}</td>
              <td>
                <span class="pill" :style="row.success ? okStyle : failStyle">{{ label(row.success ? 'ok' : 'error') }}</span>
              </td>
              <td>{{ row.ip }}</td>
              <td>{{ formatTime(row.created_at) }}</td>
            </tr>
            <tr v-if="!logs.rows.length && !logs.loading">
              <td colspan="4" class="muted">{{ t('empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination
        :page="logs.page"
        :page-size="logs.size"
        :total="logs.total"
        :total-pages="logs.totalPages"
        :loading="logs.loading"
        @page="logs.changePage"
        @size="logs.changePageSize"
      />
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { request, requestRaw } from '../api/client.js';
import { authStore as auth } from '../stores/auth.js';
import { usePagedTable } from '../composables/usePagedTable.js';
import Pagination from '../components/Pagination.vue';
import { t, label, LANGUAGES, setLang } from '../i18n/index.js';

const router = useRouter();
const user = computed(() => auth.user);

const form = reactive({ name: '', email: '', phone: '', studentNo: '', nationality: '', language: 'zh-CN' });
const saving = ref(false);
const savedTip = ref('');
const uploading = ref(false);
const avatarError = ref('');
const avatarUrl = ref('');

const pw = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwSaving = ref(false);
const pwError = ref('');

// 必须包 reactive()：usePagedTable 返回的是一堆 ref，模板里的 logs.rows / logs.total
// 不会自动解包，直接渲染会得到空单元格和「共 [object Object] 条」
const logs = reactive(usePagedTable('/auth/login-logs', { pageSize: 10 }));

const okStyle = { background: '#e7f7ee', color: '#1c7a45' };
const failStyle = { background: '#fdecec', color: '#a92f2f' };

const initial = computed(() => (user.value?.name || user.value?.username || '?').slice(0, 1).toUpperCase());

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function fillFromUser(source) {
  if (!source) return;
  form.name = source.name || '';
  form.email = source.email || '';
  form.phone = source.phone || '';
  form.studentNo = source.student_no || '';
  form.nationality = source.nationality || '';
  form.language = source.language || 'zh-CN';
  avatarUrl.value = source.avatar_url || '';
}

async function saveProfile() {
  saving.value = true;
  savedTip.value = '';
  try {
    await request('/auth/profile', { method: 'PUT', body: { ...form } });
    await auth.refresh();
    setLang(form.language);
    savedTip.value = t('profileSaved');
    setTimeout(() => { savedTip.value = ''; }, 2000);
  } catch (error) {
    avatarError.value = error.message;
  } finally {
    saving.value = false;
  }
}

/** 头像直传原始字节，服务端用 magic bytes 复核真实类型。 */
async function upload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  avatarError.value = '';
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = t('avatarHint');
    return;
  }

  uploading.value = true;
  try {
    const data = await requestRaw('/auth/profile/avatar', file);
    avatarUrl.value = data.avatar_url;
    await auth.refresh();
  } catch (error) {
    avatarError.value = error.message;
  } finally {
    uploading.value = false;
  }
}

async function changePassword() {
  pwError.value = '';
  if (pw.newPassword !== pw.confirmPassword) {
    pwError.value = t('passwordMismatch');
    return;
  }

  pwSaving.value = true;
  try {
    await request('/auth/change-password', {
      method: 'POST',
      body: { oldPassword: pw.oldPassword, newPassword: pw.newPassword }
    });
    // 后端会作废旧令牌，必须重新登录
    await auth.logout({ silent: true });
    router.push('/login');
  } catch (error) {
    pwError.value = error.message;
  } finally {
    pwSaving.value = false;
  }
}

onMounted(async () => {
  const fresh = await auth.refresh().catch(() => null);
  fillFromUser(fresh || auth.user);
});
</script>
