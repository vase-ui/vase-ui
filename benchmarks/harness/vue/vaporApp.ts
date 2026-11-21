import type { VaporComponent } from 'vue-3.6';
import App from './App.vue';

/**
 * The root of a Vapor app. The build compiles `App.vue` in Vapor mode in a Vapor setup, and vue-tsc
 * types each SFC as a virtual DOM component.
 */
export const VaporApp = App as unknown as VaporComponent;
