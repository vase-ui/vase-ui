import { createSSRApp } from 'vue';
import { start } from '../start.ts';
import App from './App.vue';

start(() => {
  createSSRApp(App).mount('#app');
  document.documentElement.dataset.benchHydrated = '';
});
