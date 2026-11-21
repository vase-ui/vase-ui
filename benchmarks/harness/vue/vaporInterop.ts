import { createVaporApp, vaporInteropPlugin } from 'vue-3.6';
import { start } from '../start.ts';
import { VaporApp } from './vaporApp.ts';

start(() => createVaporApp(VaporApp).use(vaporInteropPlugin).mount('#app'));
