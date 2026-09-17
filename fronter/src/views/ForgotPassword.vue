<template>
  <section class="card auth-card">
    <h2>{{ t('forgotPassword') }}</h2>

    <!-- 平台没有邮件服务，走「用户名 + 邮箱/学号」核验身份后发一次性重置码 -->
    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="notice" class="alert success">{{ notice }}</p>

    <form class="form" @submit.prevent="submit">
      <label>
        {{ t('username') }}
        <input v-model.trim="form.username" autocomplete="username" required />
      </label>

      <label>
        {{ t('identifyBy') }}
        <select v-model="form.by">
          <option value="email">{{ t('byEmail') }}</option>
          <option value="studentNo">{{ t('byStudentNo') }}</option>
        </select>
      </label>

      <label v-if="form.by === 'email'">
        {{ t('email') }}
        <input v-model.trim="form.email" type="email" required />
      </label>
      <label v-else>
        {{ t('studentNo') }}
        <input v-model.trim="form.studentNo" required />
      </label>

      <label v-if="stage === 'reset'">
        {{ t('resetCode') }}
        <input v-model.trim="form.code" inputmode="numeric" maxlength="6" :placeholder="t('resetCodeHint')" required />
      </label>
      <label v-if="stage === 'reset'">
        {{ t('newPassword') }}
        <input v-model="form.newPassword" type="password" autocomplete="new-password" required minlength="8" />
        <span class="hint">{{ t('passwordRule') }}</span>
      </label>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? t('loading') : (stage === 'reset' ? t('resetPassword') : t('sendResetCode')) }}
      </button>
    </form>

    <div class="row auth-links">
      <router-link to="/login">{{ t('login') }}</router-link>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { request } from '../api/client.js';
import { t } from '../i18n/index.js';

const router = useRouter();

const form = reactive({ username: '', by: 'email', email: '', studentNo: '', code: '', newPassword: '' });
const stage = ref('request'); // request → reset
const loading = ref(false);
const error = ref('');
const notice = ref('');

async function submit() {
  loading.value = true;
  error.value = '';
  notice.value = '';

  try {
    if (stage.value === 'request') {
      const data = await request('/auth/password/forgot', { method: 'POST', body: { ...form } });
      stage.value = 'reset';
      // 开发环境下后端会把重置码回传，方便演示；生产环境只能由管理员转达
      notice.value = data?.code ? `${t('resetCodeSent')} ${data.code}` : t('resetCodeSent');
    } else {
      await request('/auth/password/reset', {
        method: 'POST',
        body: { username: form.username, code: form.code, newPassword: form.newPassword }
      });
      notice.value = t('resetSuccess');
      setTimeout(() => router.push('/login'), 900);
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>
