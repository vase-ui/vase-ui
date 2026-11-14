import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, provide, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Drawer from '../index.parts';
import { DrawerProviderContext } from '../provider/DrawerProviderContext';
import { useDrawerRootContext } from './DrawerRootContext';

// With `android` set, a root that made its close watcher in `setup` would read `window` here.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');
  return {
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

describe('<Drawer.Root /> on a server', () => {
  it('renders its default slot with no payload and attaches no store to its handle', async () => {
    const handle = Drawer.createHandle<number>();

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Drawer.Root handle={handle} defaultOpen>
            {{
              default: ({ payload }: { payload: number | undefined }) => <p>{String(payload)}</p>,
            }}
          </Drawer.Root>
        ),
      }),
    );

    expect(html).toContain('<p>undefined</p>');
    expect(handle.isOpen).toBe(false);
    expect(handle.store).toBe(handle.serverStore);
  });

  it('gives the snap point and the swipe direction to the parts', async () => {
    const Probe = defineComponent({
      setup() {
        const { activeSnapPoint, swipeDirection, frontmostHeight } = useDrawerRootContext();
        return () => (
          <p>
            snap:{String(activeSnapPoint.value)} direction:{swipeDirection.value} height:
            {frontmostHeight.value}
          </p>
        );
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Drawer.Root defaultOpen snapPoints={['100px', 1]} swipeDirection="right">
            <Probe />
          </Drawer.Root>
        ),
      }),
    );

    expect(html).toContain('snap:100px direction:right height:0');
  });

  it('reports nothing to a provider, and reads no window for a close watcher', async () => {
    const setDrawerOpen = vi.fn();
    const removeDrawer = vi.fn();
    const Provider = defineComponent({
      setup(_, { slots }) {
        provide(DrawerProviderContext, {
          setDrawerOpen,
          removeDrawer,
          active: shallowRef(false),
          visualStateStore: {
            getSnapshot: () => ({ swipeProgress: 0, frontmostHeight: 0 }),
            subscribe: () => () => {},
            set: () => {},
          },
        });
        return () => slots.default?.();
      },
    });

    await renderToString(
      createSSRApp({
        render: () => (
          <Provider>
            <Drawer.Root defaultOpen />
          </Provider>
        ),
      }),
    );

    expect(setDrawerOpen).not.toHaveBeenCalled();
    expect(removeDrawer).not.toHaveBeenCalled();
  });
});
