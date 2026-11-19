import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { usePopupHover } from './usePopupHover';

// The store of a module is the store of a handle that no root controls. Each request shares it.
const sharedStore = getEmptyRootStore();

const Trigger = defineComponent({
  setup() {
    const hoverProps = usePopupHover(sharedStore).trigger({
      delay: 500,
      safePolygon: true,
    });
    return () => <button {...hoverProps} />;
  },
});

describe('usePopupHover trigger on a server', () => {
  it('adds no listener to a store that two renders share', async () => {
    const on = vi.spyOn(sharedStore.context.events, 'on');

    const first = await renderToString(createSSRApp(Trigger));
    const second = await renderToString(createSSRApp(Trigger));

    expect(on).not.toHaveBeenCalled();
    expect(first).toBe('<button></button>');
    expect(second).toBe(first);
  });
});
