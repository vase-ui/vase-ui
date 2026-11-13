import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { provideFloatingNode } from '../tree/FloatingTree';
import type { FloatingRootStore } from './FloatingRootStore';
import { getEmptyRootStore } from './getEmptyRootStore';
import { useFloatingRootStore } from './useFloatingRootStore';

// All server requests share the store of a module.
const emptyStore = getEmptyRootStore();

const Writer = defineComponent(() => {
  emptyStore.set('anchorElement', { nodeType: 1 } as Element);
  return () => <span>{String(emptyStore.select('anchorElement'))}</span>;
});

const Reader = defineComponent(() => () => (
  <span>{String(emptyStore.select('anchorElement'))}</span>
));

describe('getEmptyRootStore on a server', () => {
  it('gives the initial value to a render after another render wrote to the store', async () => {
    const first = await renderToString(createSSRApp(Writer));
    const second = await renderToString(createSSRApp(Reader));

    expect(first).toBe('<span>null</span>');
    expect(second).toBe('<span>null</span>');
  });
});

describe('useFloatingRootStore on a server', () => {
  it('makes the store from its options in setup, and starts no watcher', async () => {
    const open = vi.fn(() => true);
    let store!: FloatingRootStore;
    const Parent = defineComponent((_, { slots }) => {
      provideFloatingNode('parent');
      return () => slots.default?.();
    });
    const Part = defineComponent(() => {
      store = useFloatingRootStore({ open });
      return () => (
        <span data-open={String(store.select('open'))} data-nested={String(store.context.nested)} />
      );
    });
    const Page = defineComponent(() => () => (
      <Parent>
        <Part />
      </Parent>
    ));

    const html = await renderToString(createSSRApp(Page));

    expect(html).toContain('<span data-open="true" data-nested="true"></span>');
    expect(open).toHaveBeenCalledTimes(1);
    expect(store.context.triggerElements.size).toBe(0);
  });
});
