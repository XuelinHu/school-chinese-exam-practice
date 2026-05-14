import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from '../stores/auth.js';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import Home from '../views/Home.vue';
import PracticeList from '../views/PracticeList.vue';
import PracticeDetail from '../views/PracticeDetail.vue';
import Records from '../views/Records.vue';
import WrongBook from '../views/WrongBook.vue';
import Profile from '../views/Profile.vue';
import Dashboard from '../views/Dashboard.vue';
import AdminTable from '../views/AdminTable.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/practice', component: PracticeList, meta: { auth: true } },
  { path: '/practice/:id', component: PracticeDetail, meta: { auth: true } },
  { path: '/records', component: Records, meta: { auth: true } },
  { path: '/wrong-book', component: WrongBook, meta: { auth: true } },
  { path: '/profile', component: Profile, meta: { auth: true } },
  { path: '/admin', component: Dashboard, meta: { auth: true, admin: true } },
  { path: '/admin/users', component: AdminTable, props: { type: 'users' }, meta: { auth: true, admin: true } },
  { path: '/admin/questions', component: AdminTable, props: { type: 'questions' }, meta: { auth: true, admin: true } },
  { path: '/admin/papers', component: AdminTable, props: { type: 'papers' }, meta: { auth: true, admin: true } },
  { path: '/admin/records', component: AdminTable, props: { type: 'records' }, meta: { auth: true, admin: true } }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  if (to.meta.auth && !authStore.isAuthed) return '/login';
  if (to.meta.admin && authStore.user?.role !== 'admin') return '/';
  return true;
});

export default router;
