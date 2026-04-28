// src/router.ts
import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from 'firebase/auth';
import EventsPage from './pages/EventsPage.vue';
import { routeLoading } from './stores/routeLoading';
import HomePage from './views/HomePage.vue';
import LoginPage from './views/LoginPage.vue';
import ProfilePage from './views/ProfilePage.vue';
import SettingsPage from './views/SettingsPage.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomePage,
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfilePage,
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/events',
    name: 'Events',
    component: EventsPage,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  routeLoading.value = true;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = getAuth().currentUser;

  if (to.path === '/login' && isAuthenticated) {
    next('/events');
    return;
  }

  if (to.path === '/' && isAuthenticated) {
    next('/events');
    return;
  }

  if (requiresAuth && !isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

router.afterEach(() => {
  routeLoading.value = false;
});

router.onError(() => {
  routeLoading.value = false;
});

export default router;
