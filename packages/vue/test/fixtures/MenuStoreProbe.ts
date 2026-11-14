import { defineComponent } from 'vue';
import { useMenuRootContext } from '../../src/menu/root/MenuRootContext';
import type { MenuRootContext } from '../../src/menu/root/MenuRootContext';

/**
 * A part with no element that reads the context of the root above it, as each part of the family
 * does. A test puts `Probe` in the root, and reads `context` and `store` after the render.
 */
export function createMenuStoreProbe() {
  const contexts: MenuRootContext[] = [];
  const Probe = defineComponent({
    setup() {
      contexts.push(useMenuRootContext());
      return () => null;
    },
  });

  return {
    Probe,
    get context() {
      return contexts[0];
    },
    get store() {
      return contexts[0].store;
    },
  };
}
