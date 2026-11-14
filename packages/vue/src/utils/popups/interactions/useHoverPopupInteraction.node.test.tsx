import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { useHoverPopupInteraction } from './useHoverPopupInteraction';

// The store of a module is the store of a handle that no root controls. Each request shares it.
const sharedStore = getEmptyRootStore();

const Popup = defineComponent({
  setup() {
    useHoverPopupInteraction(sharedStore, { closeDelay: 500 });
    return () => <div />;
  },
});

describe('useHoverPopupInteraction on a server', () => {
  it('adds no listener to a store that two renders share', async () => {
    const on = vi.spyOn(sharedStore.context.events, 'on');

    const first = await renderToString(createSSRApp(Popup));
    const second = await renderToString(createSSRApp(Popup));

    expect(on).not.toHaveBeenCalled();
    expect(first).toBe('<div></div>');
    expect(second).toBe(first);
  });
});
