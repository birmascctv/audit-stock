import { createRouter, createWebHistory } from 'vue-router';
import AuditView from '../views/AuditView.vue';
import AuditHistoryView from '../views/AuditHistoryView.vue';
import LoginView from '../views/LoginView.vue';

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/audit',
    name: 'Audit',
    component: AuditView,
  },
  {
    path: '/wordpress',
    redirect: '/login',
  },
  {
    path: '/history',
    name: 'History',
    component: AuditHistoryView,
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, left: 0, behavior: 'instant' };
  },
});

router.beforeEach((to, from, next) => {
  let isAuth = false;
  try {
    const session = sessionStorage.getItem('birmas_audit_session_v4');
    isAuth = !!session;
  } catch {
    isAuth = false;
  }

  if (to.path !== '/login' && !isAuth) {
    next('/login');
  } else if (to.path === '/login' && isAuth) {
    next('/audit');
  } else {
    next();
  }
});

export default router;
