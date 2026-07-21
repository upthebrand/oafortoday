import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import TodayView from './views/TodayView.vue';
import MonthView from './views/MonthView.vue';
import PrintView from './views/PrintView.vue';
import AccountView from './views/AccountView.vue';
import { useNotifications } from './stores/notifications.js';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView },
    { path: '/day/:date(\\d{4}-\\d{2}-\\d{2})', name: 'day', component: TodayView, props: true },
    { path: '/month', name: 'month', component: MonthView },
    { path: '/print/:year(\\d{4})/:month(\\d{1,2})', name: 'print', component: PrintView, props: true },
    { path: '/account', name: 'account', component: AccountView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

createApp(App).use(router).mount('#app');

useNotifications().refresh();
