import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, onMounted, onScopeDispose, provide, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  firePointer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { platform } from '../../common/platform';
import * as DrawerCloseDataAttributes from '../../dialog/close/DialogCloseDataAttributes';
import * as Dialog from '../../dialog/index.parts';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';
import * as DrawerTriggerDataAttributes from '../../dialog/trigger/DialogTriggerDataAttributes';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import * as Drawer from '../index.parts';
import { DrawerProviderContext, useDrawerProviderContext } from '../provider/DrawerProviderContext';
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
type SnapPoint = Drawer.Root.SnapPoint;

const TestCase = defineComponent({
  props: {
    onOpenChange: { type: Function as PropType<(open: boolean) => void>, required: true },
  },
  setup(props) {
    const open = shallowRef(true);

    return () => (
      <Drawer.Root
        open={open.value}
        onOpenChange={(nextOpen: boolean) => {
          open.value = nextOpen;
          props.onOpenChange(nextOpen);
        }}
        swipeDirection="right"
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

async function simulateTimedRightSwipe(
  element: HTMLElement,
  startX: number,
  endX: number,
  startTime: number,
  moveTime: number,
  endTime: number,
) {
  await simulateTimedSwipe(element, [
    { type: 'down', x: startX, y: 100, time: startTime },
    { type: 'move', x: startX + 1, y: 100, time: moveTime },
    { type: 'move', x: endX, y: 100, time: endTime - 1 },
    { type: 'up', x: endX, y: 100, time: endTime },
  ]);
}

async function simulateTimedDownSwipe(
  element: HTMLElement,
  startY: number,
  endY: number,
  startTime: number,
  moveTime: number,
  endTime: number,
  settleTime?: number,
) {
  const resolvedSettleTime =
    typeof settleTime === 'number' && Number.isFinite(settleTime) ? settleTime : null;

  await simulateTimedSwipe(element, [
    { type: 'down', x: 100, y: startY, time: startTime },
    { type: 'move', x: 100, y: startY + 1, time: moveTime },
    ...(resolvedSettleTime !== null
      ? ([{ type: 'move', x: 100, y: endY - 1, time: resolvedSettleTime }] as TimedSwipeStep[])
      : []),
    { type: 'move', x: 100, y: endY, time: endTime - 1 },
    { type: 'up', x: 100, y: endY, time: endTime },
  ]);
}

type TimedSwipeStep = {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
  time: number;
};

async function simulateTimedSwipe(element: HTMLElement, steps: TimedSwipeStep[]) {
  // Every step carries its own `timeStamp`, so the gesture's timeline no longer depends on the
  // wall clock and no `vi.setSystemTime` bookkeeping is needed alongside it.
  for (const step of steps) {
    const init = {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: step.x,
      clientY: step.y,
      timeStamp: step.time,
    };

    if (step.type === 'down') {
      await firePointer.down(element, { ...init, button: 0, buttons: 1 });
    } else if (step.type === 'move') {
      await firePointer.move(element, { ...init, buttons: 1 });
    } else {
      await firePointer.up(element, { ...init, button: 0, buttons: 0 });
    }

    await flushMicrotasks();
  }
}

function mockResizeObserver() {
  const original = globalThis.ResizeObserver;
  if (typeof original === 'function') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  }
  return () => {
    if (typeof original === 'function') {
      globalThis.ResizeObserver = original;
    }
  };
}

/**
 * Sets up `elementFromPoint` and `ResizeObserver` mocks for swipe-dismiss tests.
 * Returns a cleanup function that restores originals.
 */
function setupSwipeTestEnv() {
  const originalElementFromPoint = document.elementFromPoint;
  const restoreResizeObserver = mockResizeObserver();
  return {
    /** Call after rendering to point `elementFromPoint` at the given element. */
    pointAt(element: Element) {
      document.elementFromPoint = () => element;
    },
    cleanup() {
      document.elementFromPoint = originalElementFromPoint;
      restoreResizeObserver();
    },
  };
}

const SnapPointResetCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[2]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                Drawer
                <Drawer.Close data-testid="close">Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const ActiveSnapPointDisplay = defineComponent({
  setup() {
    const { activeSnapPoint } = useDrawerRootContext();
    return () => <div data-testid="active-snap">{String(activeSnapPoint.value)}</div>;
  },
});

const DefaultSnapPointResetCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);

    return () => (
      <Drawer.Root
        defaultSnapPoint={snapPoints[1]}
        open={open.value}
        onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
        snapPoints={snapPoints}
      >
        <ActiveSnapPointDisplay />
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

const SnapPointChangeDetailsCase = defineComponent({
  props: {
    onSnapPointChange: {
      type: Function as PropType<
        (snapPoint: SnapPoint | null, eventDetails: Drawer.Root.SnapPointChangeEventDetails) => void
      >,
      required: true,
    },
  },
  setup(props) {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[2]);

    return () => (
      <Drawer.Root
        open={open.value}
        onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
        snapPoints={snapPoints}
        snapPoint={snapPoint.value}
        onSnapPointChange={(
          nextSnapPoint: SnapPoint | null,
          eventDetails: Drawer.Root.SnapPointChangeEventDetails,
        ) => {
          snapPoint.value = nextSnapPoint;
          props.onSnapPointChange(nextSnapPoint, eventDetails);
        }}
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

const CanceledCloseSnapPointResetCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[2]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => {
            if (!nextOpen) {
              eventDetails.cancel();
            } else {
              open.value = nextOpen;
            }
          }}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                Drawer
                <Drawer.Close data-testid="close">Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const ControlledAlwaysOpenCase = defineComponent({
  props: {
    onOpenChange: Function as PropType<
      (open: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => void
    >,
  },
  setup(props) {
    return () => (
      <Drawer.Root open onOpenChange={props.onOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport" style={{ height: '300px' }}>
            <Drawer.Popup data-testid="popup" style={{ height: '200px' }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

const ControlledSwipeCloseSnapPointCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    // Start at '300px' (non-default) so we can distinguish correct reset to
    // the default ('100px') from incorrect restoration to the pre-swipe value.
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[1]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport" style={{ height: '600px' }}>
              <Drawer.Popup data-testid="popup" style={{ height: '600px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const CanceledSwipeCloseCase = defineComponent({
  setup() {
    const open = shallowRef(true);

    return () => (
      <Drawer.Root
        open={open.value}
        onOpenChange={(nextOpen: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => {
          if (!nextOpen && eventDetails.reason === REASONS.swipe) {
            eventDetails.cancel();
            return;
          }

          open.value = nextOpen;
        }}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport" style={{ height: '300px' }}>
            <Drawer.Popup data-testid="popup" style={{ height: '200px' }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

const CanceledSwipeCloseSnapPointCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[0]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => {
            if (!nextOpen && eventDetails.reason === REASONS.swipe) {
              eventDetails.cancel();
              return;
            }

            open.value = nextOpen;
          }}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport" style={{ height: '600px' }}>
              <Drawer.Popup data-testid="popup" style={{ height: '600px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const SnapPointOvershootCase = defineComponent({
  setup() {
    return () => (
      <Drawer.Root open defaultSnapPoint={1} snapPoints={['100px', 1]} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport" style={{ height: '400px' }}>
            <Drawer.Popup data-testid="popup" style={{ height: '400px' }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

const SnapPointSwipeCase = defineComponent({
  props: {
    onOpenChange: { type: Function as PropType<(open: boolean) => void>, required: true },
  },
  setup(props) {
    const snapPoints = ['100px', '300px', 1];
    const open = shallowRef(true);
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[0]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean) => {
            open.value = nextOpen;
            props.onOpenChange(nextOpen);
          }}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" style={{ height: '600px' }}>
              <Drawer.Popup data-testid="popup" style={{ height: '600px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const SnapPointSequentialSkipCase = defineComponent({
  setup() {
    const snapPoints = ['100px', '300px', 1];
    const snapPoint = shallowRef<SnapPoint | null>(snapPoints[0]);

    return () => (
      <div>
        <div data-testid="active-snap">{String(snapPoint.value)}</div>
        <Drawer.Root
          open
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
          swipeDirection="down"
          snapToSequentialPoints
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" style={{ height: '600px' }}>
              <Drawer.Popup data-testid="popup" style={{ height: '600px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

const SnapPointGestureCase = defineComponent({
  props: {
    initialSnapPoint: { type: [Number, String] as PropType<SnapPoint | null>, default: null },
    keepMounted: Boolean,
    rejectClose: Boolean,
    snapToSequentialPoints: Boolean,
    swipeDirection: {
      type: String as PropType<Drawer.Root.Props['swipeDirection']>,
      default: 'down',
    },
  },
  setup(props) {
    const snapPoints = ['100px', '300px', 1];
    const snapPoint = shallowRef<SnapPoint | null>(props.initialSnapPoint);
    const open = shallowRef(true);

    return () => (
      <div>
        <output data-testid="active-snap">{String(snapPoint.value)}</output>
        <Drawer.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean) => {
            if (!props.rejectClose) {
              open.value = nextOpen;
            }
          }}
          snapPoints={snapPoints}
          snapPoint={snapPoint.value}
          onSnapPointChange={(value: SnapPoint | null) => (snapPoint.value = value)}
          snapToSequentialPoints={props.snapToSequentialPoints}
          swipeDirection={props.swipeDirection}
        >
          <Drawer.Portal keepMounted={props.keepMounted}>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport" style={{ height: '600px' }}>
              <Drawer.Popup data-testid="popup" style={{ height: '600px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  },
});

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

const TestDrawer = defineComponent({
  props: {
    open: { type: Boolean, default: undefined },
    defaultOpen: Boolean,
    onOpenChange: Function as PropType<
      (open: boolean, details: Drawer.Root.ChangeEventDetails) => void
    >,
  },
  setup(props, { slots }) {
    return () => (
      <Drawer.Root
        open={props.open}
        defaultOpen={props.defaultOpen}
        onOpenChange={props.onOpenChange}
      >
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>{slots.default ? slots.default() : 'Drawer'}</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
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

  it('exposes the attributes rendered by borrowed trigger and close parts', async () => {
    const { user } = await render(
      <Drawer.Root modal={false}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Trigger disabled>Disabled</Drawer.Trigger>
        <Drawer.Close disabled>Close</Drawer.Close>
      </Drawer.Root>,
    );

    const disabledTrigger = screen.getByRole('button', { name: 'Disabled' });
    expect(disabledTrigger).toHaveAttribute(DrawerTriggerDataAttributes.disabled);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toHaveAttribute(DrawerCloseDataAttributes.disabled);

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute(DrawerTriggerDataAttributes.popupOpen);
  });

  it('uses a size-based swipe threshold', async () => {
    const handleOpenChange = vi.fn();
    await render(<TestCase onOpenChange={handleOpenChange} />);

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');

    popup.style.width = '200px';
    await flushMicrotasks();

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      const startTime = 1000;
      const moveTime = 1100;
      const endTime = 1600;

      await simulateTimedRightSwipe(viewport, 100, 190, startTime, moveTime, endTime);
      expect(handleOpenChange).not.toHaveBeenCalled();

      await simulateTimedRightSwipe(
        viewport,
        100,
        220,
        startTime + 1000,
        moveTime + 1000,
        endTime + 1000,
      );
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('supports detached triggers with handles', async () => {
    const handle = Drawer.createHandle<number>();

    await render(
      <div>
        <Drawer.Trigger handle={handle} payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root
          handle={handle}
          v-slots={{
            default: ({ payload }: { payload: number | undefined }) => (
              <Drawer.Portal>
                <Drawer.Viewport>
                  <Drawer.Popup>
                    <span data-testid="payload">{payload}</span>
                    <Drawer.Close>Close</Drawer.Close>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            ),
          }}
        />
      </div>,
    );

    expect(screen.queryByTestId('payload')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Trigger 1' }));
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('1');

    await fireEvent.click(screen.getByText('Close'));
    await flushMicrotasks();
    expect(screen.queryByTestId('payload')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Trigger 2' }));
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('2');
  });

  it('does not re-render inactive detached triggers when the popup opens and closes', async () => {
    const handle = Drawer.createHandle();
    const bystander = { renders: 0 };

    const { user } = await render(
      <div>
        <Drawer.Trigger handle={handle}>Trigger 1</Drawer.Trigger>
        <Drawer.Trigger
          handle={handle}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => {
              bystander.renders += 1;
              return <button {...props}>Trigger 2</button>;
            },
          }}
        />
        <Drawer.Root handle={handle}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger 1' });

    async function openAndClose() {
      await user.click(trigger);
      expect(await screen.findByTestId('popup')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    bystander.renders = 0;
    await openAndClose();
    await openAndClose();
    expect(bystander.renders).toBe(0);
  });

  it('supports imperative actions with handles', async () => {
    const handle = Drawer.createHandle<number>();

    await render(
      <div>
        <Drawer.Trigger handle={handle} id="trigger-1" payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} id="trigger-2" payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root
          handle={handle}
          v-slots={{
            default: ({ payload }: { payload: number | undefined }) => (
              <Drawer.Portal>
                <Drawer.Viewport>
                  <Drawer.Popup data-testid="content">{payload}</Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            ),
          }}
        />
      </div>,
    );

    const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    expect(screen.queryByRole('dialog')).toBe(null);

    handle.open('trigger-2');
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBe(null);
    });

    expect(screen.getByTestId('content').textContent).toBe('2');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');

    handle.close();
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null);
    });
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');

    handle.openWithPayload(8);
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBe(null);
    });
    expect(screen.getByTestId('content').textContent).toBe('8');
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');
  });

  it('attaches fresh root state when a handle-backed root remounts', async () => {
    const handle = Drawer.createHandle<number>();

    const App = defineComponent({
      setup() {
        const mounted = shallowRef(true);

        return () => (
          <>
            <Drawer.Trigger handle={handle} id="trigger" payload={1}>
              Trigger
            </Drawer.Trigger>
            {!mounted.value && (
              <button type="button" onClick={() => (mounted.value = true)}>
                Remount root
              </button>
            )}
            {mounted.value && (
              <Drawer.Root
                handle={handle}
                v-slots={{
                  default: ({ payload }: { payload: number | undefined }) => (
                    <>
                      <span data-testid="payload">{payload ?? 'No payload'}</span>
                      <Drawer.Portal>
                        <Drawer.Viewport>
                          <Drawer.Popup>
                            Drawer content
                            <button type="button" onClick={() => (mounted.value = false)}>
                              Unmount root
                            </button>
                          </Drawer.Popup>
                        </Drawer.Viewport>
                      </Drawer.Portal>
                    </>
                  ),
                }}
              />
            )}
          </>
        );
      },
    });

    const { user } = await render(<App />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });

    expect(screen.getByTestId('payload').textContent).toBe('No payload');

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Drawer content')).toBeVisible();
    });
    expect(screen.getByTestId('payload').textContent).toBe('1');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );

    await user.click(screen.getByRole('button', { name: 'Unmount root' }));
    expect(handle.isOpen).toBe(false);
    expect(screen.queryByText('Drawer content')).toBe(null);

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handle.openWithPayload(8);
    handle.open('trigger');
    handle.close();
    const detachedWarnings = consoleWarn.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' && message.includes('no root that uses this handle is mounted'),
    );
    consoleWarn.mockRestore();

    expect(handle.isOpen).toBe(false);
    expect(detachedWarnings).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Remount root' }));
    expect(screen.getByTestId('payload').textContent).toBe('No payload');
    expect(screen.queryByText('Drawer content')).toBe(null);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(trigger).not.toHaveAttribute('aria-controls');

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Drawer content')).toBeVisible();
    });
    expect(screen.getByTestId('payload').textContent).toBe('1');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );
  });

  it('synchronizes trigger aria-controls with the popup id', async () => {
    const { user } = await render(
      <Drawer.Root>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).not.toBe(null);
    });

    const popup = screen.getByTestId('popup');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('resets the active snap point when closing', async () => {
    await render(<SnapPointResetCase />);

    const closeButton = screen.getByTestId('close');
    await fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('100px');
  });

  it('resets to the default snap point when provided', async () => {
    await render(<DefaultSnapPointResetCase />);

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');

    const closeButton = screen.getByTestId('close');
    await fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');
  });

  it('provides event details when snap point changes', async () => {
    const handleSnapPointChange = vi.fn();
    await render(<SnapPointChangeDetailsCase onSnapPointChange={handleSnapPointChange} />);

    const closeButton = screen.getByTestId('close');
    await fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(handleSnapPointChange).toHaveBeenCalled();
    const [, eventDetails] = handleSnapPointChange.mock.calls[0];
    expect(eventDetails.reason).toBe(REASONS.closePress);
  });

  it('does not reset snap point when a close is canceled', async () => {
    await render(<CanceledCloseSnapPointResetCase />);

    expect(screen.getByTestId('active-snap').textContent).toBe('1');

    await fireEvent.click(screen.getByTestId('close'));
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('1');
  });

  it('honors canceled snap point changes and falls back from invalid uncontrolled values', async () => {
    const handleSnapPointChange = vi.fn(
      (nextSnapPoint: SnapPoint | null, eventDetails: Drawer.Root.SnapPointChangeEventDetails) => {
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

  it.each([
    { label: 'a controlled drawer', rootProps: { open: true } },
    { label: 'a default-open drawer', rootProps: { defaultOpen: true } },
  ])('reports and unregisters $label before passive effects', async ({ rootProps }) => {
    let taskAfterMountRan = false;
    let taskAfterTeardownRan = false;
    let mountedBeforeTask: boolean | null = null;
    let unmountedBeforeTask: boolean | null = null;
    let phase: 'mount' | 'teardown' = 'mount';
    const patchedContexts = new WeakSet<object>();

    const TaskBoundary = defineComponent({
      setup() {
        onMounted(() => {
          setTimeout(() => {
            taskAfterMountRan = true;
          });
        });
        return () => null;
      },
    });

    const ProviderMethodProbe = defineComponent({
      setup() {
        const providerContext = useDrawerProviderContext();

        if (providerContext && !patchedContexts.has(providerContext)) {
          patchedContexts.add(providerContext);
          const { setDrawerOpen, removeDrawer } = providerContext;

          providerContext.setDrawerOpen = (...args) => {
            if (mountedBeforeTask === null) {
              mountedBeforeTask = !taskAfterMountRan;
            }
            setDrawerOpen(...args);
          };
          providerContext.removeDrawer = (...args) => {
            if (phase === 'teardown' && unmountedBeforeTask === null) {
              unmountedBeforeTask = !taskAfterTeardownRan;
            }
            removeDrawer(...args);
          };
        }

        return () => null;
      },
    });

    const showDrawer = shallowRef(true);
    await render(() => (
      <Drawer.Provider>
        {showDrawer.value && <TaskBoundary />}
        {showDrawer.value && <ProviderMethodProbe />}
        {showDrawer.value && <Drawer.Root modal={false} {...rootProps} />}
        <Drawer.IndentBackground data-testid="background" />
      </Drawer.Provider>
    ));

    expect(mountedBeforeTask).toBe(true);
    expect(screen.getByTestId('background')).toHaveAttribute('data-active', '');

    phase = 'teardown';
    setTimeout(() => {
      taskAfterTeardownRan = true;
    });
    showDrawer.value = false;
    await flushMicrotasks();

    expect(unmountedBeforeTask).toBe(true);
    expect(screen.getByTestId('background')).toHaveAttribute('data-inactive', '');
  });

  it('clears swipe-dismiss styles when swipe close is canceled', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<CanceledSwipeCloseCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');

      Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

      env.pointAt(popup);

      await simulateTimedDownSwipe(viewport, 100, 250, 1000, 1010, 1040);

      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
      expect(backdrop).not.toHaveAttribute('data-swipe-dismiss');
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(backdrop).not.toHaveAttribute('data-swiping');
      expect(popup).toHaveAttribute('data-open', '');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    } finally {
      env.cleanup();
    }
  });

  it('does not dismiss a controlled drawer via swipe when open is always true', async () => {
    const handleOpenChange = vi.fn();
    const env = setupSwipeTestEnv();

    try {
      await render(<ControlledAlwaysOpenCase onOpenChange={handleOpenChange} />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');

      Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

      env.pointAt(popup);

      await simulateTimedDownSwipe(viewport, 100, 250, 1000, 1010, 1040);

      // onOpenChange should still be called so the parent knows about the dismiss intent
      expect(handleOpenChange).toHaveBeenCalledWith(false, expect.anything());

      await waitSingleFrame();
      await flushMicrotasks();

      // The drawer should remain open without data-swipe-dismiss
      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
      expect(backdrop).not.toHaveAttribute('data-swipe-dismiss');
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(popup).toHaveAttribute('data-open', '');
    } finally {
      env.cleanup();
    }
  });

  it('does not restore snap point when a controlled swipe close is accepted by the parent', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<ControlledSwipeCloseSnapPointCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      await simulateTimedDownSwipe(viewport, 100, 260, 1000, 1010, 1040);
      expect(screen.getByTestId('active-snap').textContent).toBe('100px');
    } finally {
      env.cleanup();
    }
  });

  it('restores snap point and swipe offsets when swipe close is canceled', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<CanceledSwipeCloseSnapPointCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      await simulateTimedDownSwipe(viewport, 100, 260, 1000, 1010, 1040);

      expect(screen.getByTestId('active-snap').textContent).toBe('100px');
      expect(popup).toHaveAttribute('data-open', '');
      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    } finally {
      env.cleanup();
    }
  });

  it('damps active snap point overshoot after the swipe direction is established', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointOvershootCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      await fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 200,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      await fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 200,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      await fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      await fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 50,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(popup.style.transform).toBe('');
      expect(
        Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y')),
      ).toBeCloseTo(-Math.sqrt(150));
    } finally {
      env.cleanup();
    }
  });

  it('allows dragging past a snap point when snapToSequentialPoints is enabled', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointSequentialSkipCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      const startTime = 1000;
      const moveTime = 1010;
      const endTime = 1040;

      await simulateTimedDownSwipe(viewport, 500, 50, startTime, moveTime, endTime);

      expect(screen.getByTestId('active-snap').textContent).toBe('1');
    } finally {
      env.cleanup();
    }
  });

  it.each([false, true])(
    'advances on a short flick with a trailing stationary sample: %s',
    async (phantom) => {
      const env = setupSwipeTestEnv();

      try {
        await render(<SnapPointSequentialSkipCase />);

        const viewport = screen.getByTestId('viewport');
        env.pointAt(screen.getByTestId('popup'));

        await simulateTimedSwipe(viewport, [
          { type: 'down', x: 100, y: 500, time: 992 },
          { type: 'move', x: 100, y: 500, time: 1000 },
          { type: 'move', x: 100, y: 488, time: 1016 },
          { type: 'move', x: 100, y: 476, time: 1032 },
          { type: 'move', x: 100, y: 464, time: 1048 },
          ...(phantom ? [{ type: 'move' as const, x: 100, y: 463.5, time: 1064 }] : []),
          { type: 'up', x: 100, y: phantom ? 463.5 : 464, time: phantom ? 1072 : 1056 },
        ]);

        expect(screen.getByTestId('active-snap').textContent).toBe('300px');
      } finally {
        env.cleanup();
      }
    },
  );

  it('stays on the current snap point after repeated stationary samples', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointSequentialSkipCase />);

      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 500, time: 992 },
        { type: 'move', x: 100, y: 500, time: 1000 },
        { type: 'move', x: 100, y: 460, time: 1016 },
        { type: 'move', x: 100, y: 460, time: 1032 },
        { type: 'move', x: 100, y: 460, time: 1048 },
        { type: 'move', x: 100, y: 460, time: 1064 },
        { type: 'up', x: 100, y: 460, time: 1072 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('100px');
    } finally {
      env.cleanup();
    }
  });

  it('advances to the next snap point on fast flicks when snapToSequentialPoints is enabled', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointSequentialSkipCase />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      const startTime = 2000;
      const moveTime = 2010;
      const endTime = 2050;

      await simulateTimedDownSwipe(viewport, 500, 460, startTime, moveTime, endTime);

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
    } finally {
      env.cleanup();
    }
  });

  it('keeps the drawer open on low-velocity swipes near a snap point', async () => {
    const handleOpenChange = vi.fn();
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointSwipeCase onOpenChange={handleOpenChange} />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      const startTime = 1000;
      const moveTime = 1005;
      const settleTime = 1015;
      const endTime = 1035;

      await simulateTimedDownSwipe(viewport, 100, 120, startTime, moveTime, endTime, settleTime);

      expect(handleOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId('active-snap').textContent).toBe('100px');
    } finally {
      env.cleanup();
    }
  });

  it('keeps the drawer open when the release velocity reverses during an upward swipe', async () => {
    const handleOpenChange = vi.fn();
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointSwipeCase onOpenChange={handleOpenChange} />);

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      const startTime = 1000;
      const nudgeTime = 1003;
      const peakTime = 1010;
      const reversalTime = 1015;
      const endTime = 1025;

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 300, time: startTime },
        { type: 'move', x: 100, y: 299, time: nudgeTime },
        { type: 'move', x: 100, y: 120, time: peakTime },
        { type: 'move', x: 100, y: 140, time: reversalTime },
        { type: 'up', x: 100, y: 140, time: endTime },
      ]);

      expect(handleOpenChange).not.toHaveBeenCalledWith(false);
    } finally {
      env.cleanup();
    }
  });

  it('chooses the nearest sequential snap point on a slow drag', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="100px" snapToSequentialPoints />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 500, time: 1000 },
        { type: 'move', x: 100, y: 499, time: 1010 },
        { type: 'move', x: 100, y: 350, time: 2010 },
        { type: 'up', x: 100, y: 350, time: 2011 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
    } finally {
      env.cleanup();
    }
  });

  it('advances a sequential snap point toward dismissal', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint={1} snapToSequentialPoints />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 140, time: 1020 },
        { type: 'up', x: 100, y: 140, time: 1021 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
    } finally {
      env.cleanup();
    }
  });

  it('dismisses past the final sequential snap point', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="100px" snapToSequentialPoints />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 160, time: 1020 },
        { type: 'up', x: 100, y: 160, time: 1021 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
  });

  it('dismisses when a slow snap-point drag ends closer to closed', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="100px" snapToSequentialPoints />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 180, time: 2010 },
        { type: 'up', x: 100, y: 180, time: 2011 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
  });

  it('dismisses from upward snap points using upward velocity', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="100px" swipeDirection="up" />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 500, time: 1000 },
        { type: 'move', x: 100, y: 499, time: 1010 },
        { type: 'move', x: 100, y: 420, time: 1020 },
        { type: 'up', x: 100, y: 420, time: 1021 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
  });

  it('opens from a controlled null snap point', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint={null} />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 99, time: 1010 },
        { type: 'move', x: 100, y: 60, time: 1020 },
        { type: 'up', x: 100, y: 60, time: 1021 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('1');
    } finally {
      env.cleanup();
    }
  });

  it('dismisses from a controlled null snap point', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint={null} />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 160, time: 1020 },
        { type: 'up', x: 100, y: 160, time: 1021 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
  });

  it('keeps the first sequential snap point on a fast opening flick', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint={1} snapToSequentialPoints />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 99, time: 1010 },
        { type: 'move', x: 100, y: 40, time: 1020 },
        { type: 'up', x: 100, y: 40, time: 1021 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('1');
    } finally {
      env.cleanup();
    }
  });

  it('keeps the current snap point after a sub-threshold drag', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="300px" />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 105, time: 2010 },
        { type: 'up', x: 100, y: 105, time: 2011 },
      ]);

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
    } finally {
      env.cleanup();
    }
  });

  it('dismisses a non-sequential snap point when closed is nearest', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<SnapPointGestureCase initialSnapPoint="100px" />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 180, time: 2010 },
        { type: 'up', x: 100, y: 180, time: 2011 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
  });

  it('finishes a controlled accepted dismissal while kept mounted', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(
        <SnapPointGestureCase initialSnapPoint="100px" keepMounted snapToSequentialPoints />,
      );
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 160, time: 1020 },
        { type: 'up', x: 100, y: 160, time: 1021 },
      ]);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed', '');
    } finally {
      env.cleanup();
    }
  });

  it('restores a snap point when a controlled parent rejects dismissal', async () => {
    const env = setupSwipeTestEnv();

    try {
      // Start from a non-default snap point. Root's open change handler resets the snap point
      // to the default ('100px') even when the parent rejects the close, so only a
      // non-default starting point shows that the rejected dismissal restores it.
      await render(<SnapPointGestureCase initialSnapPoint="300px" rejectClose />);
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 160, time: 1020 },
        { type: 'up', x: 100, y: 160, time: 1021 },
      ]);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    } finally {
      env.cleanup();
    }
  });

  it('closes an uncontrolled drawer after a slow long drag', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(
        <Drawer.Root defaultOpen swipeDirection="down">
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup" style={{ height: '200px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );
      const viewport = screen.getByTestId('viewport');
      env.pointAt(screen.getByTestId('popup'));

      await simulateTimedSwipe(viewport, [
        { type: 'down', x: 100, y: 100, time: 1000 },
        { type: 'move', x: 100, y: 101, time: 1010 },
        { type: 'move', x: 100, y: 250, time: 2010 },
        { type: 'up', x: 100, y: 250, time: 2011 },
      ]);

      expect(screen.queryByTestId('popup')).toBe(null);
    } finally {
      env.cleanup();
    }
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

    function currentWatcher() {
      return CloseWatcherStub.instances[CloseWatcherStub.instances.length - 1];
    }

    async function requestClose(cancelable = true) {
      currentWatcher().requestClose(cancelable);
      await flushMicrotasks();
    }

    function activeWatchers() {
      return CloseWatcherStub.instances.filter((watcher) => watcher.active);
    }

    it('closes when the watcher requests a close', async () => {
      const handleOpenChange = vi.fn();
      await render(<TestDrawer defaultOpen onOpenChange={handleOpenChange} />);

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: REASONS.closeWatcher }),
      );
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(currentWatcher().active).toBe(false);
    });

    it('keeps the same watcher active when a cancelable close request is canceled', async () => {
      let shouldCancel = true;
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        if (shouldCancel) {
          details.cancel();
        }
      });
      await render(<TestDrawer defaultOpen onOpenChange={handleOpenChange} />);
      const watcher = currentWatcher();
      const instanceCount = CloseWatcherStub.instances.length;

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(CloseWatcherStub.instances).toHaveLength(instanceCount);
      expect(watcher.active).toBe(true);

      shouldCancel = false;
      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(watcher.active).toBe(false);
    });

    it('closes on a close request that cannot be prevented even if onOpenChange cancels it', async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      await render(<TestDrawer defaultOpen onOpenChange={handleOpenChange} />);

      await requestClose(false);

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      const details = handleOpenChange.mock.calls[0][1];
      expect(details.event.cancelable).toBe(false);
      expect(details.isCanceled).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(currentWatcher().active).toBe(false);
    });

    it.each([false, true])(
      'steps through content on back presses until one cannot be prevented (controlled: %s)',
      async (controlled) => {
        const SteppedDrawer = defineComponent({
          setup() {
            const open = shallowRef(true);
            const step = shallowRef(2);
            return () => (
              <TestDrawer
                defaultOpen
                open={controlled ? open.value : undefined}
                onOpenChange={(nextOpen, details) => {
                  if (step.value > 0 && details.event.cancelable) {
                    details.cancel();
                    step.value -= 1;
                    return;
                  }
                  open.value = nextOpen;
                }}
              >
                step {step.value}
              </TestDrawer>
            );
          },
        });

        await render(<SteppedDrawer />);
        const watcher = currentWatcher();
        const instanceCount = CloseWatcherStub.instances.length;

        await requestClose();
        expect(screen.getByRole('dialog')).toHaveTextContent('step 1');
        expect(CloseWatcherStub.instances).toHaveLength(instanceCount);
        expect(watcher.active).toBe(true);

        await requestClose(false);
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(watcher.active).toBe(false);
      },
    );

    it('destroys the watcher on unmount', async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { unmount } = await render(<TestDrawer defaultOpen onOpenChange={handleOpenChange} />);
      const watcher = currentWatcher();

      await requestClose();
      expect(watcher.active).toBe(true);

      unmount();
      expect(watcher.active).toBe(false);
    });

    it('makes no watcher on a platform that is not Android', async () => {
      Object.defineProperty(platform.os, 'android', { value: false, configurable: true });
      onTestFinished(() => {
        Object.defineProperty(platform.os, 'android', { value: true, configurable: true });
      });
      await render(<TestDrawer defaultOpen />);

      expect(CloseWatcherStub.instances).toHaveLength(0);
    });

    it('has a watcher only for the top drawer', async () => {
      const childOpen = shallowRef(false);
      await render(() => (
        <TestDrawer defaultOpen>
          <TestDrawer open={childOpen.value} />
        </TestDrawer>
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
        setup: () => () => <TestDrawer defaultOpen />,
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
            'onUpdate:snapPoint': (snapPoint: SnapPoint | null) =>
              calls.push(`update:snapPoint ${snapPoint}`),
          }}
        >
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
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

    it('emits no snapPointChange at a close of a root with no snap points', async () => {
      const handleSnapPointChange = vi.fn();
      let root!: Drawer.Root.Actions;
      await render(() => (
        <Drawer.Root
          ref={(instance: unknown) => {
            root = instance as Drawer.Root.Actions;
          }}
          defaultOpen
          onSnapPointChange={handleSnapPointChange}
        />
      ));

      root.close();
      await flushMicrotasks();

      expect(handleSnapPointChange).not.toHaveBeenCalled();
    });

    it('keeps a controlled snap point until the parent writes it, and follows v-model:snapPoint', async () => {
      const snapPoint = shallowRef<SnapPoint | null>('300px');
      const follow = shallowRef(false);
      let context!: DrawerRootContext;
      await render(() => (
        <Drawer.Root
          snapPoints={['100px', '300px']}
          snapPoint={snapPoint.value}
          {...{
            'onUpdate:snapPoint': (value: SnapPoint | null) => {
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
      const snapPoints = shallowRef<SnapPoint[] | undefined>(['100px', '300px']);
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
      const snapPoints = shallowRef<SnapPoint[]>(['100px', '300px']);
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

      // A popup that is not mounted reports a height of 0. The frontmost height does not change.
      parent.onPopupHeightChange(0);
      expect(parent.popupHeight.value).toBe(0);
      expect(parent.frontmostHeight.value).toBe(320);

      child.notifyParentFrontmostHeight?.(120);
      expect(parent.frontmostHeight.value).toBe(120);

      // A nested drawer reports 0 when it closes. The popup of the parent has no height. The
      // frontmost height does not change.
      child.notifyParentFrontmostHeight?.(0);
      expect(parent.frontmostHeight.value).toBe(120);
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
          <DialogStoreProbe onStore={(value) => (parent = value)} />
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
