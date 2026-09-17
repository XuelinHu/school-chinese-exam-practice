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
  {
    path: '/admin',
    component: AdminLayout,
    meta: { auth: true, admin: true },
    children: [
      { path: '', component: AdminDashboard, meta: { titleKey: 'dataBoard' } },
      { path: 'students', component: AdminStudents, meta: { titleKey: 'users' } },
      { path: 'questions', component: AdminQuestions, meta: { titleKey: 'questions' } },
      { path: 'papers', component: AdminPapers, meta: { titleKey: 'papers' } },
      { path: 'records', component: AdminRecords, meta: { titleKey: 'adminRecords' } },
      { path: 'levels', component: AdminLevels, meta: { titleKey: 'levels' } },
      { path: 'categories', component: AdminCategories, meta: { titleKey: 'categories' } },
      { path: 'login-logs', component: AdminLoginLogs, meta: { titleKey: 'loginLogsMenu' } },
      { path: 'online', component: AdminOnline, meta: { titleKey: 'onlineStatus' } },
      { path: 'ai/settings', component: AdminAiSettings, meta: { titleKey: 'aiSettings' } },
      { path: 'ai/sessions', component: AdminAiSessions, meta: { titleKey: 'aiSessions' } },
      { path: 'ai/logs', component: AdminAiLogs, meta: { titleKey: 'aiLogs' } }
    ]
  }
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
  // 刷新后本地 user 可能还没就绪，先对齐一次再判断管理员身份
  if (to.meta.auth && !authStore.user) await authStore.refresh();
  if (to.meta.admin && !authStore.isAdmin) return '/';
  return true;
});

export default router;
