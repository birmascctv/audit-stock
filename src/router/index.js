import { createRouter, createWebHistory } from 'vue-router';
import AuditView from '../views/AuditView.vue';
import WordPressView from '../views/WordPressView.vue';
import AuditHistoryView from '../views/AuditHistoryView.vue';
import LoginView from '../views/LoginView.vue';

const routes = [
  {
    path: '/',
    redirect: '/audit',
  },
  {
    path: '/audit',
    name: 'Audit',
    component: AuditView,
  },
  {
    path: '/wordpress',
    name: 'WordPress',
    component: WordPressView,
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
    redirect: '/audit',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
