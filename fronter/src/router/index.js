import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from '../stores/auth.js';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import ForgotPassword from '../views/ForgotPassword.vue';
import Home from '../views/Home.vue';
import PracticeList from '../views/PracticeList.vue';
import PracticeDetail from '../views/PracticeDetail.vue';
import Records from '../views/Records.vue';
import WrongBook from '../views/WrongBook.vue';
import Profile from '../views/Profile.vue';

// 教学查看区按需加载：只有教师与超管会用到
const TeachingStudents = () => import('../views/TeachingStudents.vue');
const TeachingStudent = () => import('../views/TeachingStudent.vue');

// 后台按需加载：学员端不该为管理台的十几个页面付出首屏体积
const AdminLayout = () => import('../layouts/AdminLayout.vue');
const AdminDashboard = () => import('../views/admin/AdminDashboard.vue');
const AdminStudents = () => import('../views/admin/AdminStudents.vue');
const AdminQuestions = () => import('../views/admin/AdminQuestions.vue');
const AdminPapers = () => import('../views/admin/AdminPapers.vue');
const AdminRecords = () => import('../views/admin/AdminRecords.vue');
const AdminLevels = () => import('../views/admin/AdminLevels.vue');
const AdminCategories = () => import('../views/admin/AdminCategories.vue');
const AdminLoginLogs = () => import('../views/admin/AdminLoginLogs.vue');
const AdminOnline = () => import('../views/admin/AdminOnline.vue');
const AdminAiSettings = () => import('../views/admin/AdminAiSettings.vue');
const AdminAiSessions = () => import('../views/admin/AdminAiSessions.vue');
const AdminAiLogs = () => import('../views/admin/AdminAiLogs.vue');

const routes = [
  { path: '/', component: Home, meta: { titleKey: 'home' } },
  { path: '/login', component: Login, meta: { titleKey: 'login' } },
  { path: '/register', component: Register, meta: { titleKey: 'register' } },
  { path: '/forgot-password', component: ForgotPassword, meta: { titleKey: 'forgotPassword' } },
  { path: '/practice', component: PracticeList, meta: { auth: true, titleKey: 'practice' } },
  { path: '/practice/:id', component: PracticeDetail, meta: { auth: true, titleKey: 'practice' } },
  { path: '/records', component: Records, meta: { auth: true, titleKey: 'records' } },
  { path: '/wrong-book', component: WrongBook, meta: { auth: true, titleKey: 'wrongBook' } },
  { path: '/profile', component: Profile, meta: { auth: true, titleKey: 'profile' } },
  // 教学查看区（只读）：教师与超管可进，内容管理员与学员被守卫拦回
  { path: '/teaching', component: TeachingStudents, meta: { auth: true, teaching: true, titleKey: 'teaching' } },
  { path: '/teaching/:id', component: TeachingStudent, meta: { auth: true, teaching: true, titleKey: 'teaching' } },
  {
    path: '/admin',
    component: AdminLayout,
    // admin = 「后台人员」：超管与内容管理员都能进外壳，菜单再按角色过滤
    meta: { auth: true, admin: true },
    children: [
      // superAdmin = 仅超管。含学员个人数据的页面（用户/成绩/日志/在线/会话）都不给内容管理员。
      { path: '', component: AdminDashboard, meta: { titleKey: 'dataBoard', superAdmin: true } },
      { path: 'students', component: AdminStudents, meta: { titleKey: 'users', superAdmin: true } },
      { path: 'questions', component: AdminQuestions, meta: { titleKey: 'questions' } },
      { path: 'papers', component: AdminPapers, meta: { titleKey: 'papers' } },
      { path: 'records', component: AdminRecords, meta: { titleKey: 'adminRecords', superAdmin: true } },
      { path: 'levels', component: AdminLevels, meta: { titleKey: 'levels' } },
      { path: 'categories', component: AdminCategories, meta: { titleKey: 'categories' } },
      { path: 'login-logs', component: AdminLoginLogs, meta: { titleKey: 'loginLogsMenu', superAdmin: true } },
      { path: 'online', component: AdminOnline, meta: { titleKey: 'onlineStatus', superAdmin: true } },
      { path: 'ai/settings', component: AdminAiSettings, meta: { titleKey: 'aiSettings', superAdmin: true } },
      { path: 'ai/sessions', component: AdminAiSessions, meta: { titleKey: 'aiSessions', superAdmin: true } },
      { path: 'ai/logs', component: AdminAiLogs, meta: { titleKey: 'aiLogs', superAdmin: true } },
      // 兜底：/admin 下拼错的地址（学员管理是 /admin/students，常被写成 /admin/users）
      // 此前会渲染一个只剩侧边栏的空白外壳。重定向到 /admin 后交给下面那条
      // superAdmin 规则分流：超管留在数据看板，内容管理员被送回 /admin/questions。
      { path: ':pathMatch(.*)*', redirect: '/admin' }
    ]
  },
  // 全局兜底：未定义的路径此前既不跳转也不报错，只是渲染空白页并把错误 URL 留在地址栏。
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => {
  if (to.meta.auth && !authStore.isAuthed) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  // 刷新后本地 user 可能还没就绪，先对齐一次再判断角色
  if (to.meta.auth && !authStore.user) await authStore.refresh();

  if (to.meta.admin && !authStore.isStaff) return '/';
  // 内容管理员直敲 /admin/students 这类超管地址（含被兜底重定向过来的）不报错，
  // 送回他能用的第一个菜单
  if (to.meta.superAdmin && !authStore.isSuperAdmin) return '/admin/questions';
  if (to.meta.teaching && !authStore.canTeach) return '/';
  return true;
});

export default router;
