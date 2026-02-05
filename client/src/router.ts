// src/router.ts
import { createRouter, createWebHistory } from 'vue-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { routeLoading } from './stores/routeLoading';
import HomePage from './views/HomePage.vue';
import LoginPage from './views/LoginPage.vue';
import ProfilePage from './views/ProfilePage.vue';
import EventsPage from './pages/EventsPage.vue';

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
    path: '/events',
    name: 'Events',
    component: EventsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfilePage,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const auth = getAuth();

const getCurrentUser = () =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

router.beforeEach(async (to, from, next) => {
  routeLoading.value = true;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const currentUser = auth.currentUser ?? await getCurrentUser();
  const isAuthenticated = Boolean(currentUser);

  if ((to.path === '/' || to.path === '/login') && isAuthenticated) {
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
