import { describe, expect, it } from 'vitest';
import { defineComponent, onMounted, onScopeDispose, watchEffect } from 'vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { useItemRegistry } from './useItemRegistry';

describe('useItemRegistry', () => {
  const { render } = createRenderer();

  const Item = defineComponent(
    (props: { id: string; registerItem: (id: string, value: string) => () => void }) => {
      let unregister: (() => void) | undefined;
      onMounted(() => {
        unregister = props.registerItem(props.id, props.id);
      });
      onScopeDispose(() => unregister?.());
      return () => null;
    },
    { props: ['id', 'registerItem'] },
  );

  function createApp(snapshots: ReadonlyMap<string, string>[]) {
    return defineComponent(
      (props: { items: string[] }) => {
        const { items: registeredItems, registerItem } = useItemRegistry<string, string>();

        return () => {
          snapshots.push(registeredItems.value);
          return props.items.map((item) => (
            <Item key={item} id={item} registerItem={registerItem} />
          ));
        };
      },
      { props: ['items'] },
    );
  }

  it('publishes one immutable snapshot for all registrations in a commit', async () => {
    const snapshots: ReadonlyMap<string, string>[] = [];
    const App = createApp(snapshots);

    const { setProps } = await render(<App items={['a', 'b', 'c']} />);

    expect(snapshots.map((snapshot) => Array.from(snapshot.keys()))).toEqual([[], ['a', 'b', 'c']]);

    await setProps({ items: ['b', 'd'] });

    expect(Array.from(snapshots.at(-1)?.keys() ?? [])).toEqual(['b', 'd']);
    expect(Array.from(snapshots[1].keys())).toEqual(['a', 'b', 'c']);
  });

  it('publishes an empty snapshot once the last item unregisters', async () => {
    const snapshots: ReadonlyMap<string, string>[] = [];
    const App = createApp(snapshots);

    const { setProps } = await render(<App items={['a', 'b']} />);
    expect(Array.from(snapshots[snapshots.length - 1].keys())).toEqual(['a', 'b']);

    await setProps({ items: [] });

    expect(Array.from(snapshots[snapshots.length - 1].keys())).toEqual([]);
  });

  it('keeps a registration independent of later changes to the live map', async () => {
    const { items, liveItems, registerItem } = useItemRegistry<string, string>();
    const sizes: number[] = [];
    const Owner = defineComponent(() => {
      watchEffect((onCleanup) => {
        onCleanup(registerItem('first', 'First'));
        sizes.push(liveItems.size);
      });
      return () => <div />;
    });
    const { unmount } = await render(<Owner />);
    const before = items.value;
    const remove = registerItem('second', 'Second');
    expect(liveItems.get('second')).toBe('Second');
    await flushMicrotasks();
    expect(sizes).toEqual([1]);
    expect([...before.values()]).toEqual(['First']);
    expect([...items.value.values()]).toEqual(['First', 'Second']);

    remove();
    unmount();
    expect(items.value.size).toBe(0);
  });
});
