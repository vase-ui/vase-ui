import { createVaporSSRApp, vaporInteropPlugin } from 'vue';
import App from './App.vue';

if (!App.__vapor) throw new Error('The host must compile as a Vapor component.');
createVaporSSRApp(App).use(vaporInteropPlugin).mount('#app');
