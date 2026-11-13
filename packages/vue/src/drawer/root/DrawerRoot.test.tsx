import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, onScopeDispose, provide, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { platform } from '../../common/platform';
import * as Dialog from '../../dialog/index.parts';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';
import { REASONS } from '../../internals/reasons';
import * as Drawer from '../index.parts';
import { DrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerProviderContext as ProviderContext } from '../provider/DrawerProviderContext';
import { useDrawerRootContext } from './DrawerRootContext';
import type { DrawerRootContext } from './DrawerRootContext';
import DrawerRootHydration from './DrawerRootHydration.test.vue';

// A module namespace is read-only. The mock gives `os` as a plain object, so a block can set
// `android`.
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

type Store = DialogStore<unknown>;

const SnapPointContextControls = defineComponent({
  setup() {
    const { activeSnapPoint, setActiveSnapPoint } = useDrawerRootContext();

    return () => (
      <>
        <output data-testid="context-active-snap-point">{String(activeSnapPoint.value)}</output>
        <button onClick={() => setActiveSnapPoint('100px')}>Set canceled snap point</button>
        <button onClick={() => setActiveSnapPoint(999)}>Set invalid snap point</button>
      </>
    );
  },
});

const NestedSwipeProgressProbe = defineComponent({
  setup() {
    const { nestedSwipeProgressStore } = useDrawerRootContext();
    const progress = shallowRef(nestedSwipeProgressStore.getSnapshot());
    onScopeDispose(
      nestedSwipeProgressStore.subscribe(() => {
        progress.value = nestedSwipeProgressStore.getSnapshot();
      }),
    );

    return () => <output data-testid="nested-swipe-progress">{progress.value}</output>;
  },
});

const NestedSwipeProgressSubscriber = defineComponent({
  props: { onChange: { type: Function as PropType<() => void>, required: true } },
  setup(props) {
    const { nestedSwipeProgressStore } = useDrawerRootContext();
    onScopeDispose(nestedSwipeProgressStore.subscribe(() => props.onChange()));
    return () => null;
  },
});

const NestedSwipeProgressControls = defineComponent({
  setup() {
    const { onNestedSwipeProgressChange } = useDrawerRootContext();

    return () => (
      <>
        <button onClick={() => onNestedSwipeProgressChange(0.5)}>Set nested progress</button>
        <button onClick={() => onNestedSwipeProgressChange(Number.NaN)}>
          Set invalid nested progress
        </button>
      </>
    );
  },
});

const MissingRootContextConsumer = defineComponent({
  setup() {
    useDrawerRootContext();
    return () => null;
  },
});

const StoreProbe = defineComponent({
  props: { onStore: { type: Function as PropType<(store: Store) => void>, required: true } },
  setup(props) {
    props.onStore(useDialogRootContext());
    return () => null;
  },
});

// Gives the test the store and the context that each part of the family reads.
const RootProbe = defineComponent({
  props: {
    onRoot: {
      type: Function as PropType<(store: Store, context: DrawerRootContext) => void>,
      required: true,
    },
  },
  setup(props) {
    props.onRoot(useDialogRootContext(), useDrawerRootContext());
    return () => null;
  },
});

// The popup element of a drawer, with the props that the root gives to its popup.
const PopupElement = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const store = useDialogRootContext();
    return () =>
      store.select('mounted')
        ? h(
            'div',
            {
              ...store.select('popupProps'),
              ...attrs,
              role: 'dialog',
              ref: (element) => {
                store.context.popupRef.value = element as HTMLElement | null;
                store.set('popupElement', element as HTMLElement | null);
              },
            },
            slots.default?.(),
          )
        : null;
  },
});

function createProvider() {
  const calls: string[] = [];
  const names = new Map<object, string>();
  const name = (drawer: object) => {
    if (!names.has(drawer)) {
      names.set(drawer, `drawer${names.size + 1}`);
    }
    return names.get(drawer);
  };
  const context: ProviderContext = {
    setDrawerOpen: (drawer, open) => calls.push(`${name(drawer)} ${open}`),
    removeDrawer: (drawer) => calls.push(`${name(drawer)} removed`),
    active: shallowRef(false),
    visualStateStore: {
      getSnapshot: () => ({ swipeProgress: 0, frontmostHeight: 0 }),
      subscribe: () => () => {},
      set: () => {},
    },
  };
  const Provider = defineComponent({
    setup(_, { slots }) {
      provide(DrawerProviderContext, context);
      return () => slots.default?.();
    },
  });
  return { calls, Provider };
}

describe('<Drawer.Root />', () => {
  const { render } = createRenderer();

  it('honors canceled snap point changes and falls back from invalid uncontrolled values', async () => {
    const handleSnapPointChange = vi.fn(
      (
        nextSnapPoint: Drawer.Root.SnapPoint | null,
        eventDetails: Drawer.Root.SnapPointChangeEventDetails,
      ) => {
        if (nextSnapPoint === '100px') {
          eventDetails.cancel();
        }
      },
    );
    const { user } = await render(
      <Drawer.Root
        defaultSnapPoint="300px"
        onSnapPointChange={handleSnapPointChange}
        snapPoints={['100px', '300px']}
      >
        <SnapPointContextControls />
      </Drawer.Root>,
    );

    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');

    await user.click(screen.getByRole('button', { name: 'Set canceled snap point' }));
    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');

    await user.click(screen.getByRole('button', { name: 'Set invalid snap point' }));
    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');
    expect(handleSnapPointChange).toHaveBeenLastCalledWith(
      999,
      expect.objectContaining({ reason: REASONS.none }),
    );
  });

  it('normalizes invalid nested swipe progress without notifying for duplicate values', async () => {
    const handleProgressChange = vi.fn();
    const { user } = await render(
      <Drawer.Root>
        <NestedSwipeProgressProbe />
        <NestedSwipeProgressSubscriber onChange={handleProgressChange} />
        <Drawer.Root>
          <NestedSwipeProgressControls />
        </Drawer.Root>
      </Drawer.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Set nested progress' }));
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0.5');
    expect(handleProgressChange).toHaveBeenCalledTimes(1);

    handleProgressChange.mockClear();

    await user.click(screen.getByRole('button', { name: 'Set nested progress' }));
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0.5');
    expect(handleProgressChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Set invalid nested progress' }));
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0');
    expect(handleProgressChange).toHaveBeenCalledTimes(1);
  });

  describe('snap point', () => {
    it('emits openChange, snapPointChange, update:snapPoint and then update:open at a close', async () => {
      const calls: string[] = [];
      let root!: Drawer.Root.Actions;
      await render(() => (
        <Drawer.Root
          ref={(instance: unknown) => {
            root = instance as Drawer.Root.Actions;
          }}
          defaultOpen
          snapPoints={['100px', '300px', 1]}
          defaultSnapPoint={1}
          onOpenChange={(open, eventDetails) =>
            calls.push(`openChange ${open} ${eventDetails.reason}`)
          }
          onSnapPointChange={(snapPoint, eventDetails) =>
            calls.push(`snapPointChange ${snapPoint} ${eventDetails.reason}`)
          }
          {...{
            'onUpdate:open': (open: boolean) => calls.push(`update:open ${open}`),
            'onUpdate:snapPoint': (snapPoint: Drawer.Root.SnapPoint | null) =>
              calls.push(`update:snapPoint ${snapPoint}`),
          }}
        >
          <PopupElement />
        </Drawer.Root>
      ));

      root.close();
      await flushMicrotasks();

      expect(calls).toEqual([
        `openChange false ${REASONS.imperativeAction}`,
        `snapPointChange 1 ${REASONS.imperativeAction}`,
        'update:snapPoint 1',
        'update:open false',
      ]);
    });

    it('does not reset the snap point for a close that a listener cancels, or with no snap points', async () => {
      const handleSnapPointChange = vi.fn();
      let root!: Drawer.Root.Actions;
      let other!: Drawer.Root.Actions;
      await render(() => (
        <>
          <Drawer.Root
            ref={(instance: unknown) => {
              root = instance as Drawer.Root.Actions;
            }}
            defaultOpen
            snapPoints={['100px', 1]}
            onOpenChange={(_open, eventDetails) => eventDetails.cancel()}
            onSnapPointChange={handleSnapPointChange}
          />
          <Drawer.Root
            ref={(instance: unknown) => {
              other = instance as Drawer.Root.Actions;
            }}
            defaultOpen
            onSnapPointChange={handleSnapPointChange}
          />
        </>
      ));

      root.close();
      other.close();
      await flushMicrotasks();

      expect(handleSnapPointChange).not.toHaveBeenCalled();
    });

    it('keeps a controlled snap point until the parent writes it, and follows v-model:snapPoint', async () => {
      const snapPoint = shallowRef<Drawer.Root.SnapPoint | null>('300px');
      const follow = shallowRef(false);
      let context!: DrawerRootContext;
      await render(() => (
        <Drawer.Root
          snapPoints={['100px', '300px']}
          snapPoint={snapPoint.value}
          {...{
            'onUpdate:snapPoint': (value: Drawer.Root.SnapPoint | null) => {
              if (follow.value) {
                snapPoint.value = value;
              }
            },
          }}
        >
          <RootProbe onRoot={(_store, value) => (context = value)} />
        </Drawer.Root>
      ));

      context.setActiveSnapPoint('100px');
      await flushMicrotasks();
      expect(context.activeSnapPoint.value).toBe('300px');

      follow.value = true;
      context.setActiveSnapPoint('100px');
      await flushMicrotasks();
      expect(context.activeSnapPoint.value).toBe('100px');

      // A controlled value that is not in the list stays, and `null` is a value.
      context.setActiveSnapPoint(null);
      await flushMicrotasks();
      expect(context.activeSnapPoint.value).toBe(null);
    });

    it('uses the first snap point with no default, and the default again when the list loses the value', async () => {
      const snapPoints = shallowRef<Drawer.Root.SnapPoint[] | undefined>(['100px', '300px']);
      let context!: DrawerRootContext;
      await render(() => (
        <Drawer.Root snapPoints={snapPoints.value}>
          <RootProbe onRoot={(_store, value) => (context = value)} />
        </Drawer.Root>
      ));

      expect(context.activeSnapPoint.value).toBe('100px');

      context.setActiveSnapPoint('300px');
      expect(context.activeSnapPoint.value).toBe('300px');

      snapPoints.value = ['100px', '200px'];
      await flushMicrotasks();
      expect(context.activeSnapPoint.value).toBe('100px');
    });
  });

  describe('context of the root', () => {
    it('gives the swipe direction and the snap options, and follows their props', async () => {
      const direction = shallowRef<'left' | 'right'>('left');
      const sequential = shallowRef(false);
      const snapPoints = shallowRef<Drawer.Root.SnapPoint[]>(['100px', '300px']);
      let given!: DrawerRootContext;
      let bare!: DrawerRootContext;
      await render(() => (
        <>
          <Drawer.Root
            swipeDirection={direction.value}
            snapToSequentialPoints={sequential.value}
            snapPoints={snapPoints.value}
          >
            <RootProbe onRoot={(_store, value) => (given = value)} />
          </Drawer.Root>
          <Drawer.Root>
            <RootProbe onRoot={(_store, value) => (bare = value)} />
          </Drawer.Root>
        </>
      ));

      expect(bare.swipeDirection.value).toBe('down');
      expect(bare.snapToSequentialPoints.value).toBe(false);
      expect(bare.snapPoints.value).toBe(undefined);
      expect(bare.activeSnapPoint.value).toBe(null);
      expect(given.swipeDirection.value).toBe('left');
      expect(given.snapToSequentialPoints.value).toBe(false);
      expect(given.snapPoints.value).toEqual(['100px', '300px']);

      direction.value = 'right';
      sequential.value = true;
      snapPoints.value = ['100px', '200px'];
      await flushMicrotasks();
      expect(given.swipeDirection.value).toBe('right');
      expect(given.snapToSequentialPoints.value).toBe(true);
      expect(given.snapPoints.value).toEqual(['100px', '200px']);
    });

    it('keeps the height of the frontmost drawer of its stack', async () => {
      let parent!: DrawerRootContext;
      let child!: DrawerRootContext;
      await render(() => (
        <Drawer.Root>
          <RootProbe onRoot={(_store, value) => (parent = value)} />
          <Drawer.Root>
            <RootProbe onRoot={(_store, value) => (child = value)} />
          </Drawer.Root>
        </Drawer.Root>
      ));

      parent.onPopupHeightChange(300);
      expect(parent.popupHeight.value).toBe(300);
      expect(parent.frontmostHeight.value).toBe(300);

      child.notifyParentFrontmostHeight?.(120);
      expect(parent.frontmostHeight.value).toBe(120);

      // The height of the popup does not replace the height of an open nested drawer.
      parent.onPopupHeightChange(320);
      expect(parent.frontmostHeight.value).toBe(120);

      child.notifyParentFrontmostHeight?.(0);
      expect(parent.frontmostHeight.value).toBe(320);
    });

    it('tells each drawer above it that a nested drawer is present or swiped', async () => {
      let top!: DrawerRootContext;
      let middle!: DrawerRootContext;
      let bottom!: DrawerRootContext;
      await render(() => (
        <Drawer.Root>
          <RootProbe onRoot={(_store, value) => (top = value)} />
          <Drawer.Root>
            <RootProbe onRoot={(_store, value) => (middle = value)} />
            <Drawer.Root>
              <RootProbe onRoot={(_store, value) => (bottom = value)} />
            </Drawer.Root>
          </Drawer.Root>
        </Drawer.Root>
      ));

      expect(top.notifyParentSwipingChange).toBe(undefined);

      bottom.notifyParentHasNestedDrawer?.(true);
      expect(middle.hasNestedDrawer.value).toBe(true);
      expect(top.hasNestedDrawer.value).toBe(false);

      bottom.notifyParentSwipingChange?.(true);
      expect(middle.nestedSwiping.value).toBe(true);
      expect(top.nestedSwiping.value).toBe(true);

      bottom.notifyParentSwipeProgressChange?.(0.25);
      expect(middle.nestedSwipeProgressStore.getSnapshot()).toBe(0.25);
      expect(top.nestedSwipeProgressStore.getSnapshot()).toBe(0.25);
    });
  });

  describe('root of Dialog', () => {
    it('counts as a drawer for the dialog above it', async () => {
      let parent!: Store;
      await render(() => (
        <Dialog.Root defaultOpen modal={false}>
          <StoreProbe onStore={(value) => (parent = value)} />
          <Drawer.Root defaultOpen modal={false} />
        </Dialog.Root>
      ));

      expect(parent.select('nestedOpenDialogCount')).toBe(1);
      expect(parent.select('nestedOpenDrawerCount')).toBe(1);
    });
  });

  describe('provider', () => {
    it('reports its open state to the provider, and leaves the provider at the unmount', async () => {
      const { calls, Provider } = createProvider();
      const open = shallowRef(false);
      const { unmount } = await render(() => (
        <Provider>
          <Drawer.Root open={open.value} />
        </Provider>
      ));

      expect(calls).toEqual(['drawer1 false']);

      open.value = true;
      await flushMicrotasks();
      expect(calls).toEqual(['drawer1 false', 'drawer1 true']);

      unmount();
      expect(calls).toEqual(['drawer1 false', 'drawer1 true', 'drawer1 removed']);
    });

    it('VUE-5: reports a closed drawer while KeepAlive holds the root', async () => {
      const { calls, Provider } = createProvider();
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => <Drawer.Root defaultOpen />,
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <Provider>
          <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
        </Provider>
      ));

      expect(calls).toEqual(['drawer1 true']);

      shown.value = false;
      await flushMicrotasks();
      expect(calls).toEqual(['drawer1 true', 'drawer1 false']);

      shown.value = true;
      await flushMicrotasks();
      expect(calls).toEqual(['drawer1 true', 'drawer1 false', 'drawer1 true']);
    });
  });

  describe('CloseWatcher', () => {
    class CloseWatcherStub extends EventTarget {
      static instances: CloseWatcherStub[] = [];
      active = true;

      constructor() {
        super();
        CloseWatcherStub.instances.push(this);
      }

      destroy() {
        this.active = false;
      }

      // Mirrors the browser: `cancel` fires first and can only be prevented while the page has
      // history-action activation; otherwise the watcher is destroyed before `close` fires.
      requestClose(cancelable: boolean) {
        if (!this.active) {
          return;
        }

        const cancelEvent = new Event('cancel', { cancelable });
        this.dispatchEvent(cancelEvent);
        if (cancelEvent.defaultPrevented) {
          return;
        }

        this.destroy();
        this.dispatchEvent(new Event('close'));
      }
    }

    const win = window as Window & { CloseWatcher?: unknown | undefined };
    const originalCloseWatcher = win.CloseWatcher;

    beforeEach(() => {
      CloseWatcherStub.instances = [];
      win.CloseWatcher = CloseWatcherStub;
    });

    afterEach(() => {
      win.CloseWatcher = originalCloseWatcher;
    });

    function activeWatchers() {
      return CloseWatcherStub.instances.filter((watcher) => watcher.active);
    }

    it('closes the drawer with the reason close-watcher, and destroys the watcher', async () => {
      const handleOpenChange = vi.fn();
      let store!: Store;
      await render(() => (
        <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
          <RootProbe onRoot={(value) => (store = value)} />
          <PopupElement />
        </Drawer.Root>
      ));

      expect(activeWatchers()).toHaveLength(1);
      activeWatchers()[0].requestClose(true);
      await flushMicrotasks();

      expect(handleOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: REASONS.closeWatcher }),
      );
      expect(store.select('open')).toBe(false);
      expect(activeWatchers()).toHaveLength(0);
    });

    it('keeps the watcher for a canceled request, and closes for a request that cannot be prevented', async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      let store!: Store;
      await render(() => (
        <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
          <RootProbe onRoot={(value) => (store = value)} />
          <PopupElement />
        </Drawer.Root>
      ));
      const watcher = activeWatchers()[0];
      const instanceCount = CloseWatcherStub.instances.length;

      watcher.requestClose(true);
      await flushMicrotasks();
      expect(store.select('open')).toBe(true);
      expect(watcher.active).toBe(true);
      expect(CloseWatcherStub.instances).toHaveLength(instanceCount);

      watcher.requestClose(false);
      await flushMicrotasks();
      expect(handleOpenChange.mock.calls[1][1].isCanceled).toBe(false);
      expect(store.select('open')).toBe(false);
      expect(watcher.active).toBe(false);
    });

    it('makes no watcher on a platform that is not Android', async () => {
      Object.defineProperty(platform.os, 'android', { value: false, configurable: true });
      onTestFinished(() => {
        Object.defineProperty(platform.os, 'android', { value: true, configurable: true });
      });
      await render(() => (
        <Drawer.Root defaultOpen>
          <PopupElement />
        </Drawer.Root>
      ));

      expect(CloseWatcherStub.instances).toHaveLength(0);
    });

    it('has a watcher only for the top drawer', async () => {
      const childOpen = shallowRef(false);
      await render(() => (
        <Drawer.Root defaultOpen>
          <PopupElement>
            <Drawer.Root open={childOpen.value}>
              <PopupElement />
            </Drawer.Root>
          </PopupElement>
        </Drawer.Root>
      ));

      const parentWatcher = activeWatchers()[0];
      expect(activeWatchers()).toHaveLength(1);

      childOpen.value = true;
      await flushMicrotasks();
      expect(parentWatcher.active).toBe(false);
      expect(activeWatchers()).toHaveLength(1);

      childOpen.value = false;
      await flushMicrotasks();
      expect(activeWatchers()).toHaveLength(1);
      expect(activeWatchers()[0]).not.toBe(parentWatcher);
    });

    it('VUE-5: destroys the watcher while KeepAlive holds the root, and at the unmount', async () => {
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => (
          <Drawer.Root defaultOpen>
            <PopupElement />
          </Drawer.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      const { unmount } = await render(() => (
        <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
      ));

      expect(activeWatchers()).toHaveLength(1);

      shown.value = false;
      await flushMicrotasks();
      expect(activeWatchers()).toHaveLength(0);

      shown.value = true;
      await flushMicrotasks();
      expect(activeWatchers()).toHaveLength(1);

      unmount();
      expect(activeWatchers()).toHaveLength(0);
    });
  });

  describe('server render', () => {
    it('hydrates an open root with a nested root, with no message', async () => {
      const serverHtml = await renderOnServer('src/drawer/root/DrawerRootHydration.test.vue', {});
      expect(serverHtml).toContain('active:300px');

      await hydrate(DrawerRootHydration, { serverHtml });
    });
  });

  it('throws a descriptive error when the root context is missing', async () => {
    await expect(render(<MissingRootContextConsumer />)).rejects.toThrow(
      'Vase UI: DrawerRootContext is missing. Without it a Drawer part has no drawer to read. Put the Drawer parts inside <Drawer.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
