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

/**
 * 四类角色与后端 `middleware/role.js` 的 `ROLE` 常量一一对应。
 *
 * student / teacher 属用户端，content_admin / admin 属管理端；
 * 这里只做**界面**判断，权限边界始终在后端 `allow()`。
 */
export const authStore = reactive({
  user: readStoredUser(),
  ready: false,

  get isAuthed() {
    return Boolean(readToken());
  },

  /** 超级管理员：唯一能看用户、成绩、日志、在线状态与智能体会话的角色。 */
  get isSuperAdmin() {
    return this.user?.role === 'admin';
  },

  /** 内容管理员：只管题库 / 试卷 / 等级 / 分类。 */
  get isContentAdmin() {
    return this.user?.role === 'content_admin';
  },

  /** 后台人员（超管 + 内容管理员）：能进 `/admin` 外壳，具体菜单再按角色过滤。 */
  get isStaff() {
    return this.isSuperAdmin || this.isContentAdmin;
  },

  /** 教师：用户端只读教学查看区。 */
  get isTeacher() {
    return this.user?.role === 'teacher';
  },

  /** 能进教学查看区 —— 与后端 `TEACHING_ROLES` 保持一致（教师 + 超管）。 */
  get canTeach() {
    return this.isTeacher || this.isSuperAdmin;
  },

  /** 语义已收窄为**超级管理员**；「能否进后台」请用 `isStaff`。 */
  get isAdmin() {
    return this.isSuperAdmin;
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
