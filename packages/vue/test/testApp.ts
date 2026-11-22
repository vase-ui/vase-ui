import { inject } from 'vitest';
import * as Vue from 'vue';
import type { App, Component, Plugin } from 'vue';
import VaporRoot from './VaporRoot.vue';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The kind of app that `createTestApp` makes. */
    testApp: 'vdom' | 'vapor';
    /** The component mode of the parts. */
    testParts: 'vdom' | 'vapor';
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

/** Whether the parts compile as Vapor components in this project. */
export const isVaporParts = inject('testParts') === 'vapor';

const vaporVersionMessage = `The projects \`vapor\` and \`vapor-parts\` need Vue 3.6. The installed Vue is ${Vue.version}. Run \`pnpm install:vue-3.6\` first.`;

/**
 * Makes the app of a test. In the projects `vapor` and `vapor-parts`, it is a Vapor app
 * with `vaporInteropPlugin`. Its Vapor root component renders `root`.
 * In each other project it is an ordinary app.
 */
export function createTestApp(root: Component): App {
  if (!isVaporApp) {
    return Vue.createApp(root);
  }
  const { createVaporApp, vaporInteropPlugin } = vapor;
  if (!createVaporApp || !vaporInteropPlugin) {
    throw new Error(vaporVersionMessage);
  }
  // Vapor calls a root prop that is a function to get its value. Without the getter, Vapor calls
  // a function component in place of the value.
  const app = createVaporApp(VaporRoot, { content: () => root });
  app.use(vaporInteropPlugin);
  return app;
}

/**
 * Installs the interop plugin when the parts compile as Vapor components, and returns the app.
 * A virtual DOM app needs that plugin to render a Vapor part.
 * Call this function on each app that a test or a helper makes without `createTestApp`.
 */
export function installPartsInterop(app: App): App {
  if (isVaporParts) {
    if (!vapor.vaporInteropPlugin) {
      throw new Error(vaporVersionMessage);
    }
    app.use(vapor.vaporInteropPlugin);
  }
  return app;
}
