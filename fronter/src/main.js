import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import './assets/style.css';
import { initializeOidc, oidc } from './auth/oidc.js';
import { authStore } from './stores/auth.js';

async function start() {
  const authenticated = await initializeOidc();
  let completedLogin = false;
  if (authenticated && sessionStorage.getItem('oidc-link-pending') === '1') {
    try {
      await authStore.linkOidc(oidc.token);
      sessionStorage.setItem('oidc-link-result', 'Unified identity linked.');
    } catch (error) {
      sessionStorage.setItem('oidc-link-result', error.message);
    } finally {
      sessionStorage.removeItem('oidc-link-pending');
    }
  } else if (authenticated && sessionStorage.getItem('oidc-login-pending') === '1') {
    try {
      await authStore.loginWithOidc(oidc.token);
      sessionStorage.removeItem('oidc-login-pending');
      completedLogin = true;
    } catch (error) {
      localStorage.setItem('oidc-login-error', error.message);
      sessionStorage.removeItem('oidc-login-pending');
    }
  } else if (!authenticated) {
    sessionStorage.removeItem('oidc-login-pending');
    sessionStorage.removeItem('oidc-link-pending');
  }
  createApp(App).use(router).mount('#app');
  if (completedLogin) {
    await router.isReady();
    router.replace(router.currentRoute.value.query.redirect || '/');
  }
}

start().catch((error) => {
  localStorage.setItem('oidc-login-error', error.message || 'Unified sign-in is unavailable');
  createApp(App).use(router).mount('#app');
});
