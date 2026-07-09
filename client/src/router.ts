// src/router.ts
import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from 'firebase/auth';
import EventsPage from './pages/EventsPage.vue';
import ConcertSyncPage from './pages/ConcertSyncPage.vue';
import { routeLoading } from './stores/routeLoading';
import HomePage from './views/HomePage.vue';
import LoginPage from './views/LoginPage.vue';
import ProfilePage from './views/ProfilePage.vue';
import SettingsPage from './views/SettingsPage.vue';
import AdminIngestionUploadsPage from './pages/AdminIngestionUploadsPage.vue';
import AdminVenuesPage from './pages/AdminVenuesPage.vue';
import { isAdminEmail } from './utils/admin';

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
  {
    path: '/concert-sync',
    name: 'ConcertSync',
    component: ConcertSyncPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/ingestion/uploads',
    name: 'AdminIngestionUploads',
    component: AdminIngestionUploadsPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/venues',
    name: 'AdminVenues',
    component: AdminVenuesPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  routeLoading.value = true;
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresAdmin = to.matched.some(
    (record) => (record.meta as any).requiresAdmin,
  );
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
    return;
  }

  if (requiresAdmin) {
    const email = getAuth().currentUser?.email;
    if (!isAdminEmail(email)) {
      next('/events');
      return;
    }
  }

  next();
});

router.afterEach(() => {
  routeLoading.value = false;
});

router.onError(() => {
  routeLoading.value = false;
});

export default router;
