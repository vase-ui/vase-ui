import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import type {
  ResizableLayoutStorage,
  ResizableLayoutStorageOptions,
  ResizableRootLayoutSnapshot,
} from '@vase-ui/vue/resizable';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

describe('Resizable.useLayoutStorage', () => {
  const { render } = createRenderer();

  type RootInstance = InstanceType<typeof Resizable.Root>;

  interface LayoutOptions {
    fixed?: boolean;
    onSetup?: (storage: ReturnType<typeof Resizable.useLayoutStorage>) => void;
    root?: { current?: RootInstance };
  }

  // The container is 1000 px wide, and the handle has no size, so 1% of the panel space is 10 px.
  function createLayout(
    options: ResizableLayoutStorageOptions,
    { fixed = false, onSetup, root }: LayoutOptions = {},
  ) {
    return defineComponent(() => {
      const storage = Resizable.useLayoutStorage(options);
      onSetup?.(storage);
      return () => (
        <div style={{ width: '1000px' }}>
          <Resizable.Root
            layout={storage.layout.value}
            onLayoutCommitted={storage.save}
            {...{
              'onUpdate:layout': (next: ResizableRootLayoutSnapshot) => {
                storage.layout.value = next;
              },
            }}
            ref={(value: unknown) => {
              if (root) {
                root.current = value as RootInstance;
              }
            }}
          >
            <Resizable.Panel
              id="a"
              data-testid="a"
              rootResizeBehavior={fixed ? 'fixed' : 'proportional'}
            />
            <Resizable.Handle data-testid="handle" aria-label="Resize a" />
            <Resizable.Panel id="b" data-testid="b" />
          </Resizable.Root>
        </div>
      );
    });
  }

  function createStorage(items: Record<string, string> = {}) {
    const map = new Map(Object.entries(items));
    return {
      map,
      getItem: vi.fn((key: string) => map.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        map.set(key, value);
      }),
    };
  }

  const grows = () => ['a', 'b'].map((id) => screen.getByTestId(id).style.flexGrow);

  const pointer = { pointerId: 1, pointerType: 'mouse' };

  async function drag(distance: number) {
    const handle = screen.getByTestId('handle');
    await fireEvent.pointerDown(handle, { ...pointer, clientX: 0, buttons: 1 });
    await fireEvent.pointerMove(handle, { ...pointer, clientX: distance, buttons: 1 });
    await fireEvent.pointerUp(handle, { ...pointer, clientX: distance });
  }

  it('gives an empty layout in setup and the stored layout after the mount', async () => {
    const storage = createStorage({ layout: '{"a":25,"b":75}' });
    let layoutInSetup: ResizableRootLayoutSnapshot | undefined;
    let layout: Ref<ResizableRootLayoutSnapshot> | undefined;
    const Layout = createLayout(
      { key: 'layout', storage },
      {
        onSetup: (result) => {
          layoutInSetup = result.layout.value;
          ({ layout } = result);
        },
      },
    );

    await render(<Layout />);

    expect(layoutInSetup).toEqual({});
    expect(layout?.value).toEqual({ a: 25, b: 75 });
    expect(grows()).toEqual(['25', '75']);
  });

  it('restores a fixed panel from a stored length and saves its next size in pixels', async () => {
    const storage = createStorage({ layout: '{"a":"240px","b":"76%"}' });
    const Layout = createLayout({ key: 'layout', storage }, { fixed: true });
    const { unmount } = await render(<Layout />);
    const handle = screen.getByRole('separator');

    expect(grows()).toEqual(['24', '76']);
    expect(handle).toHaveAttribute('aria-controls', 'a');
    expect(handle).toHaveAttribute('aria-valuenow', '24');
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(storage.map.get('layout')).toBe('{"a":"250px","b":75}');
    unmount();
    await render(<Layout />);
    expect(grows()).toEqual(['25', '75']);
  });

  it('saves the snapshot of a commit under the key', async () => {
    const storage = createStorage();
    const Layout = createLayout({ key: 'layout', storage }, { fixed: true });
    await render(<Layout />);

    await drag(100);

    expect(storage.map.get('layout')).toBe('{"a":"600px","b":40}');
  });

  it('saves the layout when a call gives no details', async () => {
    const storage = createStorage();
    let save: ((layout: Record<string, number>) => void) | undefined;
    const Layout = createLayout(
      { key: 'layout', storage },
      {
        onSetup: (result) => {
          ({ save } = result);
        },
      },
    );
    await render(<Layout />);

    save?.({ a: 30, b: 70 });

    expect(storage.map.get('layout')).toBe('{"a":30,"b":70}');
  });

  it.each([
    { name: 'not JSON', item: '{"a":' },
    { name: 'an array', item: '[30,70]' },
    { name: 'null', item: 'null' },
    { name: 'a record with a bad size', item: '{"a":"1fr","b":70}' },
  ])('ignores a stored item that is $name', async ({ item }) => {
    const storage = createStorage({ layout: item });
    let layout: Ref<ResizableRootLayoutSnapshot> | undefined;
    const Layout = createLayout(
      { key: 'layout', storage },
      {
        onSetup: (result) => {
          ({ layout } = result);
        },
      },
    );

    await render(<Layout />);
    await flushMicrotasks();

    expect(storage.getItem).toHaveBeenCalledWith('layout');
    expect(layout?.value).toEqual({});
    expect(grows()).toEqual(['50', '50']);
  });

  it('ignores a storage whose getItem throws', async () => {
    const storage = createStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error('Blocked');
    });
    const Layout = createLayout({ key: 'layout', storage });

    await render(<Layout />);
    await flushMicrotasks();

    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(grows()).toEqual(['50', '50']);
  });

  it('ignores a storage whose setItem throws', async () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => {
      throw new DOMException('The quota is full.', 'QuotaExceededError');
    });
    const Layout = createLayout({ key: 'layout', storage });
    await render(<Layout />);

    await drag(100);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(grows()).toEqual(['60', '40']);
  });

  it('ignores a localStorage that throws when it is read', async () => {
    const read = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The site data is blocked.', 'SecurityError');
    });
    onTestFinished(() => {
      read.mockRestore();
    });
    const Layout = createLayout({ key: 'layout' });
    await render(<Layout />);

    await drag(100);

    expect(read).toHaveBeenCalled();
    expect(grows()).toEqual(['60', '40']);
  });

  it('uses localStorage when no storage is given', async () => {
    const key = 'vase-ui-test-resizable-local-storage';
    onTestFinished(() => {
      localStorage.removeItem(key);
    });
    const Layout = createLayout({ key });
    const { unmount } = await render(<Layout />);

    await drag(100);
    unmount();

    expect(localStorage.getItem(key)).toBe('{"a":60,"b":40}');

    await render(<Layout />);

    expect(grows()).toEqual(['60', '40']);
  });

  it('takes the storage from a getter', async () => {
    const storage = createStorage({ layout: '{"a":25,"b":75}' });
    const Layout = createLayout({ key: 'layout', storage: () => storage });
    await render(<Layout />);

    expect(grows()).toEqual(['25', '75']);

    await drag(100);

    expect(storage.map.get('layout')).toBe('{"a":35,"b":65}');
  });

  it('reads again when the key changes, and gives the defaults for a key with no item', async () => {
    const storage = createStorage({ x: '{"a":25,"b":75}', y: '{"a":70,"b":30}' });
    const key = shallowRef('x');
    const Layout = createLayout({ key, storage });
    await render(<Layout />);

    expect(grows()).toEqual(['25', '75']);

    key.value = 'y';
    await nextTick();
    await nextTick();

    expect(grows()).toEqual(['70', '30']);

    key.value = 'z';
    await nextTick();
    await nextTick();

    expect(storage.getItem).toHaveBeenLastCalledWith('z');
    expect(grows()).toEqual(['50', '50']);
  });

  it('reads again when the storage changes', async () => {
    const storage = shallowRef<ResizableLayoutStorage>(
      createStorage({ layout: '{"a":25,"b":75}' }),
    );
    const Layout = createLayout({ key: 'layout', storage });
    await render(<Layout />);

    expect(grows()).toEqual(['25', '75']);

    storage.value = createStorage({ layout: '{"a":70,"b":30}' });
    await nextTick();
    await nextTick();

    expect(grows()).toEqual(['70', '30']);
  });

  it.each([
    {
      name: 'drag',
      act: () => drag(100),
      saved: '{"a":40,"b":60}',
    },
    {
      name: 'keyboard',
      act: async () => {
        const handle = screen.getByTestId('handle');
        handle.focus();
        await fireEvent.keyDown(handle, { key: 'ArrowRight' });
      },
      saved: '{"a":31,"b":69}',
    },
    {
      name: 'reset',
      act: () => fireEvent.dblClick(screen.getByTestId('handle')),
      saved: '{"a":50,"b":50}',
    },
  ])('saves a $name commit with userChangesOnly', async ({ act, saved }) => {
    const storage = createStorage({ layout: '{"a":30,"b":70}' });
    const Layout = createLayout({ key: 'layout', storage, userChangesOnly: true });
    await render(<Layout />);
    expect(grows()).toEqual(['30', '70']);

    await act();

    expect(storage.map.get('layout')).toBe(saved);
  });

  it('ignores a commit of a method with userChangesOnly', async () => {
    const storage = createStorage();
    const root: { current?: RootInstance } = {};
    const Layout = createLayout({ key: 'layout', storage, userChangesOnly: true }, { root });
    await render(<Layout />);

    root.current?.setLayout({ a: 20, b: 80 });
    await nextTick();

    expect(grows()).toEqual(['20', '80']);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('saves a commit of a method by default', async () => {
    const storage = createStorage();
    const root: { current?: RootInstance } = {};
    const Layout = createLayout({ key: 'layout', storage }, { root });
    await render(<Layout />);

    root.current?.setLayout({ a: 20, b: 80 });
    await nextTick();

    expect(storage.map.get('layout')).toBe('{"a":20,"b":80}');
  });
});
