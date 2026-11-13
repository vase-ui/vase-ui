import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { useFocus } from './useFocus';

// The store of a module is the store of a handle that no root controls. Each request shares it.
const sharedStore = getEmptyRootStore();

const Trigger = defineComponent({
  setup() {
    const focusProps = useFocus(sharedStore, { delay: 500 });
    return () => <button {...focusProps} />;
  },
});

describe('useFocus on a server', () => {
  it('adds no listener to a store that two renders share', async () => {
    const on = vi.spyOn(sharedStore.context.events, 'on');

    const first = await renderToString(createSSRApp(Trigger));
    const second = await renderToString(createSSRApp(Trigger));

    expect(on).not.toHaveBeenCalled();
    expect(first).toBe('<button></button>');
    expect(second).toBe(first);
  });
});
