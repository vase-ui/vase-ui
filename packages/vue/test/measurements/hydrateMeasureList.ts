import * as vue from 'vue';
import MeasureHydratedList from '../fixtures/MeasureHydratedList.vue';
import type { AppKind } from '../render';

const { createVaporSSRApp, vaporInteropPlugin } = vue as unknown as {
  createVaporSSRApp: typeof vue.createSSRApp;
  vaporInteropPlugin: vue.Plugin;
};

/**
 * Hydrates `MeasureHydratedList` in `container` with the Vue of the window that loads this module.
 * A frame that loads it has a Vue of its own.
 */
export async function hydrateMeasureList(
  appKind: AppKind,
  props: Record<string, unknown>,
  container: Element,
): Promise<() => void> {
  const create = appKind.startsWith('vapor') ? createVaporSSRApp : vue.createSSRApp;
  const app = create(MeasureHydratedList, props);
  if (appKind.endsWith('interop')) app.use(vaporInteropPlugin);
  app.mount(container);
  await new Promise((resolve) => setTimeout(resolve));
  await vue.nextTick();
  return () => app.unmount();
}
