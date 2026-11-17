import { inject } from 'vitest';
import * as Vue from 'vue';
import type { App, Component, Plugin } from 'vue';
import VaporRoot from './VaporRoot.vue';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The kind of app that `createTestApp` makes. */
    testApp: 'vdom' | 'vapor';
  }
}

// The package develops on Vue 3.5, which has no Vapor exports. A named import of them is a type
// error there, and the module then does not link. The namespace object gives `undefined`.
const vapor = Vue as typeof Vue &
  Partial<{
    createVaporApp: (root: Component, props?: Record<string, unknown>) => App;
    vaporInteropPlugin: Plugin;
  }>;

/** Whether the tests of this project run in a Vapor app. */
export const isVaporApp = inject('testApp') === 'vapor';

/**
 * Makes the app of a test. In the project `vapor` it is a Vapor app with `vaporInteropPlugin`, and
 * its Vapor root component renders `root`. In each other project it is an ordinary app.
 */
export function createTestApp(root: Component): App {
  if (!isVaporApp) {
    return Vue.createApp(root);
  }
  const { createVaporApp, vaporInteropPlugin } = vapor;
  if (!createVaporApp || !vaporInteropPlugin) {
    throw new Error(`The project \`vapor\` needs Vue 3.6. The installed Vue is ${Vue.version}.`);
  }
  // Vapor calls a root prop that is a function to get its value. Without the getter, Vapor calls
  // a function component in place of the value.
  const app = createVaporApp(VaporRoot, { content: () => root });
  app.use(vaporInteropPlugin);
  return app;
}
