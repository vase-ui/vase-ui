import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { useListNavigation } from './useListNavigation';

let store: FloatingRootStore;

const List = defineComponent({
  setup() {
    store = useFloatingRootStore({ open: true });
    const navigation = useListNavigation(store, {
      id: 'list',
      listRef: shallowRef([]),
      activeIndex: 1,
      virtual: true,
      orientation: 'horizontal',
    });
    return () => (
      <>
        <input {...navigation.value.reference} />
        <div {...navigation.value.floating}>
          <div {...navigation.value.item}>item</div>
        </div>
      </>
    );
  },
});

describe('useListNavigation on a server', () => {
  it('renders the active item of an open list with virtual focus, and writes nothing to the store', async () => {
    const html = await renderToString(createSSRApp(List));

    expect(html).toBe(
      '<!--[--><input aria-activedescendant="list-1"><div aria-activedescendant="list-1"><div>item</div></div><!--]-->',
    );
    expect(store.context.orientation).toBe(undefined);
  });
});
