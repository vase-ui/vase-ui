import { createApp } from 'vue';
import { start } from '../start.ts';
import App from './App.vue';

start(() => createApp(App).mount('#app'));
