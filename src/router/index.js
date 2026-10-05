import { createRouter, createWebHistory } from 'vue-router';
import AuditView from '../views/AuditView.vue';
import AuditHistoryView from '../views/AuditHistoryView.vue';
import SalesReportView from '../views/SalesReportView.vue';
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
    meta: { requiresAuth: true, allowedRoles: ['auditor', 'superadmin'] },
  },
  {
    path: '/history',
    name: 'History',
    component: AuditHistoryView,
    meta: { requiresAuth: true, allowedRoles: ['auditor', 'superadmin'] },
  },
  {
    path: '/sales',
    name: 'Sales',
    component: SalesReportView,
    meta: { requiresAuth: true, allowedRoles: ['admin', 'superadmin'] },
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
  let user = null;
  try {
    const session = sessionStorage.getItem('birmas_audit_session_v4');
    if (session) {
      user = JSON.parse(session);
    }
  } catch {
    user = null;
  }

  const isAuth = !!user;
  const userRole = user?.role || '';

  if (to.path !== '/login' && !isAuth) {
    return next('/login');
  }

  if (to.path === '/login' && isAuth) {
    if (userRole === 'admin') {
      return next('/sales');
    }
    return next('/audit');
  }

  // Role-Based Access Control check
  if (to.meta?.allowedRoles && !to.meta.allowedRoles.includes(userRole)) {
    // If auditor tries to access sales -> redirect to /audit
    if (userRole === 'auditor') {
      return next('/audit');
    }
    // If admin tries to access stock audit -> redirect to /sales
    if (userRole === 'admin') {
      return next('/sales');
    }
    return next('/login');
  }

  next();
});

export default router;
