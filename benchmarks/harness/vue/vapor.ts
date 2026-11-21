import { createVaporApp } from 'vue-3.6';
import { start } from '../start.ts';
import { VaporApp } from './vaporApp.ts';

start(() => createVaporApp(VaporApp).mount('#app'));
