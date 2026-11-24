import * as vue from 'vue';
import type { AppKind } from './render';

const { createVaporSSRApp, vaporInteropPlugin } = vue as unknown as {
  createVaporSSRApp: typeof vue.createSSRApp;
  vaporInteropPlugin: vue.Plugin;
};

/**
 * Hydrates a component in the container with the Vue of the window that loads this module: a frame
 * has its own copy of Vue. The component must come from a module that the same window loads. The
 * app ends with its frame.
 */
export function hydrateComponent(
  appKind: AppKind,
  component: vue.Component,
  props: Record<string, unknown>,
  container: Element,
): void {
  const create = appKind.startsWith('vapor') ? createVaporSSRApp : vue.createSSRApp;
  const app = create(component, props);
  if (appKind.endsWith('interop')) app.use(vaporInteropPlugin);
  app.mount(container);
}
