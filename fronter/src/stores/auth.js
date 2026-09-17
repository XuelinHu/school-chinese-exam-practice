import { reactive } from 'vue';
import { request, setToken, token as readToken } from '../api/client.js';
import { setLang, state as i18nState } from '../i18n/index.js';

const USER_KEY = 'user';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export const authStore = reactive({
  user: readStoredUser(),
  ready: false,

  get isAuthed() {
    return Boolean(readToken());
  },

  get isAdmin() {
    return this.user?.role === 'admin';
  },

  /** 登录/刷新后统一落地：缓存用户 + 套用账号的语言偏好（跨设备生效）。 */
  applyUser(user) {
    this.user = user || null;
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);

    // 账号里存了语言偏好就以它为准；用户本次手动切过语言则不覆盖
    if (user?.language && user.language !== i18nState.lang) setLang(user.language);
  },

  async login(form) {
    const data = await request('/auth/login', { method: 'POST', body: form });
    setToken(data.token);
    this.applyUser(data.user);
    this.ready = true;
    return data.user;
  },

  async register(form) {
    return request('/auth/register', { method: 'POST', body: form });
  },

  /**
   * 拉取最新用户资料。
   *
   * 本地缓存的 user 可能是旧的（改了头像、管理员改了角色），
   * 启动时和服务端数据对齐一次；令牌过期则由 401 广播触发登出。
   */
  async refresh() {
    if (!readToken()) {
      this.ready = true;
      return null;
    }
    try {
      const user = await request('/auth/profile');
      this.applyUser(user);
      return user;
    } catch (error) {
      if (error.status === 401) this.logout({ silent: true });
      return null;
    } finally {
      this.ready = true;
    }
  },

  async logout({ silent = false } = {}) {
    if (!silent && readToken()) {
      // 记一条登出日志；失败也不能卡住本地登出
      await request('/auth/logout', { method: 'POST' }).catch(() => {});
    }
    setToken('');
    this.applyUser(null);
  }
});

// 任何请求收到 401 都统一登出，避免各处重复处理
window.addEventListener('auth:unauthorized', () => {
  if (authStore.isAuthed) authStore.logout({ silent: true });
});
