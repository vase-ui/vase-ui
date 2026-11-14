import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { userEvent } from 'vitest/browser';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import type { DialogStore } from '../../dialog/store/DialogStore';
import type { HTMLProps } from '../../internals/types';
import * as Drawer from '../index.parts';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerProviderContext } from '../provider/DrawerProviderContext';
import DrawerSwipeAreaHydration from './DrawerSwipeAreaHydration.test.vue';

const eventUtilsMockState = vi.hoisted(() => ({ forceVirtualClick: false }));

vi.mock('../../utils/popups/event', async () => {
  const actual = await vi.importActual<typeof import('../../utils/popups/event')>(
    '../../utils/popups/event',
  );
  return {
    ...actual,
    isVirtualClick(...args: Parameters<typeof actual.isVirtualClick>) {
      return eventUtilsMockState.forceVirtualClick || actual.isVirtualClick(...args);
    },
  };
});

type Point = {
  x: number;
  y: number;
};

type SwipeInput = 'pointer' | 'touch';

type SwipeContext = {
  /** Advances the gesture timeline by one step and returns the new timestamp. */
  nextTimeStamp: () => number;
};

type SwipeOptions = {
  // Receives the gesture's timeline so any event it injects stays on the same clock as the rest of
  // the swipe. Firing an untimed event here would stamp it off the real clock, landing it out of
  // order against the synthetic timestamps and skipping the release-velocity refinement.
  beforeRelease?: (context: SwipeContext) => Promise<unknown> | unknown;
  input?: SwipeInput;
  // Applies only to `input: 'pointer'`; the `touch` branch always dispatches touch events.
  pointerType?: 'mouse' | 'pen' | 'touch';
  timeStepMs?: number;
  startTimeMs?: number;
};

function dispatchTouchPointerEvent(
  element: Element,
  type: string,
  point: { clientX: number; clientY: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerType: { value: 'touch' },
    pointerId: { value: 1 },
    button: { value: 0 },
    buttons: { value: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 },
    clientX: { value: point.clientX },
    clientY: { value: point.clientY },
  });
  element.dispatchEvent(event);
}

async function swipe(element: HTMLElement, start: Point, end: Point, options: SwipeOptions = {}) {
  const stepX = start.x + (end.x === start.x ? 0 : Math.sign(end.x - start.x));
  const stepY = start.y + (end.y === start.y ? 0 : Math.sign(end.y - start.y));
  const {
    beforeRelease,
    input = 'pointer',
    pointerType = 'mouse',
    // Every pointer swipe runs on a fixed timeline. Without one the gesture's velocity is derived
    // from whatever wall-clock gaps the runner leaves between calls, and `MAX_RELEASE_VELOCITY_AGE_MS`
    // (80ms) flips the release decision whenever the machine stalls between the last move and the up.
    timeStepMs = 16,
    startTimeMs = 1,
  } = options;
  let timeStamp = startTimeMs;
  const swipeContext: SwipeContext = {
    nextTimeStamp: () => {
      timeStamp += timeStepMs;
      return timeStamp;
    },
  };

  if (input === 'touch') {
    // Touch events are still fired untimed, so a timeline handed out here would advance a counter
    // no event carries. Throwing makes that a loud failure rather than an event silently stamped
    // off the real clock, which is the trap this helper exists to close.
    const touchContext: SwipeContext = {
      nextTimeStamp: () => {
        throw new Error(
          "swipe(): `nextTimeStamp` is unavailable for `input: 'touch'` — touch events do not " +
            'carry timestamps yet, so an event stamped with it would still use the real clock.',
        );
      },
    };

    await fireTouch.start(element, { touches: [{ clientX: start.x, clientY: start.y }] });

    await flushMicrotasks();

    await fireTouch.move(element, { touches: [{ clientX: stepX, clientY: stepY }] });

    await flushMicrotasks();

    await fireTouch.move(element, { touches: [{ clientX: end.x, clientY: end.y }] });

    await flushMicrotasks();

    if (beforeRelease) {
      await beforeRelease(touchContext);
      await flushMicrotasks();
    }

    await fireTouch.end(element, { changedTouches: [{ clientX: end.x, clientY: end.y }] });

    await flushMicrotasks();
    return;
  }

  await firePointer.down(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: start.x,
    clientY: start.y,
    pointerType,
    timeStamp,
  });

  await flushMicrotasks();

  timeStamp += timeStepMs;

  await firePointer.move(element, {
    pointerId: 1,
    clientX: stepX,
    clientY: stepY,
    buttons: 1,
    pointerType,
    timeStamp,
  });

  await flushMicrotasks();

  timeStamp += timeStepMs;

  await firePointer.move(element, {
    pointerId: 1,
    clientX: end.x,
    clientY: end.y,
    buttons: 1,
    pointerType,
    timeStamp,
  });

  await flushMicrotasks();

  if (beforeRelease) {
    await beforeRelease(swipeContext);
    await flushMicrotasks();
  }

  timeStamp += timeStepMs;

  await firePointer.up(element, {
    pointerId: 1,
    clientX: end.x,
    clientY: end.y,
    pointerType,
    timeStamp,
  });

  await flushMicrotasks();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextMacrotask() {
  return wait(0);
}

// A real outside press always begins with a `pointerdown`; the swipe-open guard relies on that
// fresh press to distinguish a deliberate dismissal from the `click` synthesized by the gesture's
// own `pointerup`.
async function pressOutside(target: Element = document.body) {
  await fireEvent.pointerDown(target, { button: 0, buttons: 1, pointerType: 'mouse' });
  await fireEvent.pointerUp(target, { button: 0, buttons: 0, pointerType: 'mouse' });
  await fireEvent.click(target);
}

// A real touch tap dispatches `pointerdown` alongside `touchstart`/`touchend`, so the swipe-open
// guard re-enables on that fresh `pointerdown` before the dismissal fires — touch outside presses
// dismiss just like mouse ones.
async function pressOutsideTouch(target: Element = document.body) {
  const touch = { clientX: 0, clientY: 0 };
  await fireEvent.pointerDown(target, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'touch',
  });
  await fireTouch.start(target, { touches: [touch] });
  await fireTouch.end(target, { changedTouches: [touch], touches: [] });
  await fireEvent.pointerUp(target, { button: 0, buttons: 0, pointerId: 1, pointerType: 'touch' });
  await fireEvent.click(target);
}

async function swipeUp(element: HTMLElement, startY: number, endY: number, options?: SwipeOptions) {
  return swipe(element, { x: 10, y: startY }, { x: 10, y: endY }, options);
}

async function swipeLeft(
  element: HTMLElement,
  startX: number,
  endX: number,
  options?: SwipeOptions,
) {
  return swipe(element, { x: startX, y: 10 }, { x: endX, y: 10 }, options);
}

// Starts a gesture that opens the drawer and leaves the pointer down.
async function startOpeningSwipe(swipeArea: HTMLElement, endY = 60) {
  await fireEvent.pointerDown(swipeArea, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 0,
    clientY: 100,
    pointerType: 'mouse',
  });
  await fireEvent.pointerMove(swipeArea, {
    buttons: 1,
    pointerId: 1,
    clientX: 0,
    clientY: 99,
    pointerType: 'mouse',
  });
  await fireEvent.pointerMove(swipeArea, {
    buttons: 1,
    pointerId: 1,
    clientX: 0,
    clientY: endY,
    pointerType: 'mouse',
  });
  await flushMicrotasks();
}

type Size = { offsetWidth?: number; offsetHeight?: number };

function setSize(element: HTMLElement, size: Size) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

// Base UI gives an element its size in the `ref` callback of the part. The function ref of the
// `#render` slot gives the element its size before a part measures it.
function renderWithSize(size: Size, children?: string) {
  let sized: HTMLElement | null = null;
  return ({ props }: { props: HTMLProps }) => (
    <div
      {...props}
      ref={(element) => {
        props.ref(element);
        if (element instanceof HTMLElement && element !== sized) {
          sized = element;
          setSize(element, size);
        }
      }}
    >
      {children}
    </div>
  );
}

describe('<Drawer.SwipeArea />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.SwipeArea />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Drawer.Root>{node}</Drawer.Root>);
    },
  }));

  it('opens the drawer when swiped in the open direction', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    expect(swipeArea).toHaveAttribute('data-closed', '');

    await swipeUp(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('does not open when the swipe direction never locks to the open direction', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipe(swipeArea, { x: 10, y: 120 }, { x: 70, y: 118 });

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('prevents default pointer down for non-touch swipes', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const notCancelled = await fireEvent.pointerDown(screen.getByTestId('swipe-area'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });

    expect(notCancelled).toBe(false);
  });

  it('does not open the drawer when disabled', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" disabled />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('respects custom swipeDirection', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeLeft(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('synchronizes overshoot styles across the popup, backdrop, and provider indent', async () => {
    await render(
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="popup"
                v-slots={{
                  render: renderWithSize({ offsetHeight: 100, offsetWidth: 100 }, 'Drawer'),
                }}
              />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>,
    );

    const swipeArea = screen.getByTestId('swipe-area');
    const indent = screen.getByTestId('indent');

    await swipeLeft(swipeArea, 200, -50, {
      async beforeRelease({ nextTimeStamp }) {
        const popup = screen.getByTestId('popup');
        const backdrop = screen.getByTestId('backdrop');

        expect(
          Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-x')),
        ).toBeCloseTo(-Math.sqrt(150));
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
        expect(popup.style.transition).toBe('none');
        expect(backdrop).toHaveAttribute('data-swiping', '');
        expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('100px');
        expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');
        expect(indent.style.getPropertyValue('--drawer-height')).toBe('100px');

        await firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 0,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
        await flushMicrotasks();
        expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
        expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

        await firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: -50,
          clientY: 0,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
        await flushMicrotasks();
      },
    });

    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
    expect(screen.getByTestId('backdrop').style.getPropertyValue('--drawer-swipe-progress')).toBe(
      '0',
    );
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
  });

  it('opens from the rendered transform distance in either horizontal direction', async () => {
    await render(
      <Drawer.Root swipeDirection="left">
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="right" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              style={{ transform: 'matrix(1, 0, 0, 1, 60, 0)' }}
              v-slots={{ render: renderWithSize({ offsetWidth: 100 }, 'Drawer') }}
            />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await swipe(
      screen.getByTestId('swipe-area'),
      { x: 0, y: 10 },
      { x: 40, y: 10 },
      {
        beforeRelease() {
          expect(
            Number.parseFloat(
              screen.getByTestId('popup').style.getPropertyValue('--drawer-swipe-movement-x'),
            ),
          ).toBeCloseTo(-20);
        },
      },
    );

    expect(screen.getByTestId('swipe-area')).toHaveAttribute('data-open', '');
  });

  it('omits frontmost height when an opening drawer has no measured height', async () => {
    await render(
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup
                v-slots={{
                  render: renderWithSize({ offsetHeight: 0, offsetWidth: 100 }, 'Drawer'),
                }}
              />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>,
    );

    await swipeLeft(screen.getByTestId('swipe-area'), 100, 40, {
      beforeRelease() {
        expect(screen.getByTestId('backdrop').style.getPropertyValue('--drawer-height')).toBe('');
        expect(screen.getByTestId('indent').style.getPropertyValue('--drawer-height')).toBe('');
      },
    });
  });

  it('does not apply or close swipe state when a controlled parent rejects opening', async () => {
    const handleOpenChange = vi.fn();
    await render(
      <Drawer.Root open={false} onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal keepMounted>
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              v-slots={{ render: renderWithSize({ offsetHeight: 100 }, 'Drawer') }}
            />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await swipeUp(screen.getByTestId('swipe-area'), 120, 110, {
      startTimeMs: 1000,
      timeStepMs: 1000,
    });

    expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
    expect(handleOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');
    expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe(
      '0px',
    );
  });

  it('cancels an active opening gesture when the swipe area becomes disabled', async () => {
    let timerAfterChangeRan = false;
    let providerContext: DrawerProviderContext | undefined;
    const cleanupPhases: boolean[] = [];

    const ProviderContextCapture = defineComponent({
      setup() {
        providerContext = useDrawerProviderContext();
        return () => null;
      },
    });

    const disabled = shallowRef(false);
    await render(() => (
      <Drawer.Provider>
        <ProviderContextCapture />
        <Drawer.Root>
          <Drawer.SwipeArea
            data-testid="swipe-area"
            disabled={disabled.value}
            v-slots={{ render: renderWithSize({ offsetHeight: 100 }) }}
          />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="popup"
                v-slots={{ render: renderWithSize({ offsetHeight: 100 }, 'Drawer') }}
              />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));
    const swipeArea = screen.getByTestId('swipe-area');

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 99,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 60,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-swiping', '');

    const originalSetVisualState = providerContext!.visualStateStore.set;
    providerContext!.visualStateStore.set = (state) => {
      if (state.swipeProgress === 0) {
        cleanupPhases.push(!timerAfterChangeRan);
      }
      originalSetVisualState(state);
    };

    try {
      setTimeout(() => {
        timerAfterChangeRan = true;
      });
      disabled.value = true;
      await flushMicrotasks();
      expect(cleanupPhases.at(-1)).toBe(true);
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');
      expect(swipeArea).toHaveAttribute('data-disabled', '');

      await pressOutside();

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    } finally {
      providerContext!.visualStateStore.set = originalSetVisualState;
    }
  });

  it('keeps the drawer open when the release click follows a mid-gesture disable', async () => {
    const disabled = shallowRef(false);
    await render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" disabled={disabled.value} />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    const swipeArea = screen.getByTestId('swipe-area');

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 99,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    disabled.value = true;
    await flushMicrotasks();

    // The pointer is still down when `disabled` flips, so the gesture's eventual release
    // synthesizes a click with no fresh `pointerdown`. It must not dismiss the drawer the
    // gesture just opened.
    const releaseClick = new MouseEvent('click', { bubbles: true, detail: 1 });
    Object.defineProperty(releaseClick, 'pointerType', { value: 'mouse' });
    await fireEvent(document.body, releaseClick);

    await nextMacrotask();
    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('does not prevent a non-cancelable pointer start', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const event = new Event('pointerdown', { bubbles: true, cancelable: false });
    Object.defineProperties(event, {
      pointerType: { value: 'mouse' },
      pointerId: { value: 1 },
      button: { value: 0 },
      buttons: { value: 1 },
      clientX: { value: 0 },
      clientY: { value: 0 },
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    const dispatched = screen.getByTestId('swipe-area').dispatchEvent(event);
    await flushMicrotasks();
    expect(dispatched).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    await fireEvent.pointerCancel(screen.getByTestId('swipe-area'), {
      pointerType: 'mouse',
      pointerId: 1,
    });
    await flushMicrotasks();
  });

  it('ignores compatibility touch pointer gestures with real displacement', async () => {
    const handleOpenChange = vi.fn();
    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );
    const swipeArea = screen.getByTestId('swipe-area');

    dispatchTouchPointerEvent(swipeArea, 'pointerdown', { clientX: 0, clientY: 120 });
    dispatchTouchPointerEvent(swipeArea, 'pointermove', { clientX: 0, clientY: 40 });
    dispatchTouchPointerEvent(swipeArea, 'pointerup', { clientX: 0, clientY: 40 });
    dispatchTouchPointerEvent(swipeArea, 'pointercancel', { clientX: 0, clientY: 40 });
    await flushMicrotasks();
    expect(handleOpenChange).not.toHaveBeenCalled();

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });
    await fireEvent.pointerCancel(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');
  });

  it('follows a swipe area id change', async () => {
    let store!: DialogStore<unknown>;

    const App = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props) {
        return () => (
          <Drawer.Root>
            <DialogStoreProbe onStore={(value) => (store = value)} />
            <Drawer.SwipeArea data-testid="swipe-area" id={props.id} />
          </Drawer.Root>
        );
      },
    });

    const { setProps } = await render(<App id="first" />);

    const swipeArea = screen.getByTestId('swipe-area');
    expect(store.context.triggerElements.getById('first')).toBe(swipeArea);

    await setProps({ id: 'second' });

    expect(store.context.triggerElements.getById('first')).toBeUndefined();
    expect(store.context.triggerElements.getById('second')).toBe(swipeArea);
    expect(store.context.triggerElements.size).toBe(1);
  });

  it('opens the drawer when swiped with touch events', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
  });

  it('applies data-swiping during an active swipe gesture', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, {
      beforeRelease() {
        expect(swipeArea).toHaveAttribute('data-swiping', '');
      },
    });

    expect(swipeArea).not.toHaveAttribute('data-swiping');
  });

  it('re-enables outside press dismissal after opening by swipe', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await nextMacrotask();
    await flushMicrotasks();

    await pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('re-enables outside press dismissal for a touch outside press after opening by swipe', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await nextMacrotask();
    await flushMicrotasks();

    // A touch outside press fires `pointerdown` alongside `touchstart`/`touchend`, so it must
    // re-enable dismissal and close the swipe-opened drawer the same way a mouse press does.
    await pressOutsideTouch();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it.each([
    { input: 'pointer' as const, pointerType: 'mouse' as const },
    { input: 'pointer' as const, pointerType: 'pen' as const },
    { input: 'touch' as const, pointerType: 'touch' as const },
  ])(
    'does not dismiss from the $pointerType/$input click synthesized by the swipe-open release',
    async ({ input, pointerType }) => {
      // Dragging past the popup releases the pointer outside it, so the gesture's own pointerup
      // synthesizes a `click` over the backdrop. That click (which has no fresh pointerdown) must not
      // be read as an outside press and dismiss the drawer that was just opened — even when it lands
      // a macrotask later, after a timer-based re-enable would have fired.
      await render(
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const swipeArea = screen.getByTestId('swipe-area');

      await swipeUp(swipeArea, 120, 40, { input, pointerType });

      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

      await nextMacrotask();
      await flushMicrotasks();

      // Trailing synthesized click with no preceding fresh pointerdown.
      const releaseClick = new MouseEvent('click', { bubbles: true, detail: 1 });
      Object.defineProperty(releaseClick, 'pointerType', { value: pointerType });
      await fireEvent(document.body, releaseClick);

      await nextMacrotask();
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    },
  );

  it('suppresses a trusted release click that arrives without a preceding pointerdown', async () => {
    // A trusted dispatch performs a microtask checkpoint after each listener, so only trusted
    // input exercises the real ordering between the release guard (document capture) and
    // floating-ui's outside-press check (target phase). Browsers deliver the gesture's trailing
    // click without a fresh `pointerdown` (e.g. a touch flick within tap slop); trusted
    // low-level input cannot produce that shape directly, so the `pointerdown` is stopped at
    // the window — ahead of document capture — and only the trusted `click` flows through.
    const stopPointerDown = (event: Event) => event.stopPropagation();

    try {
      await render(
        <div>
          <div
            data-testid="outside-target"
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100px' }}
          />
          <Drawer.Root>
            <Drawer.SwipeArea
              data-testid="swipe-area"
              style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '40px' }}
            />
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup
                  data-testid="popup"
                  style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '150px' }}
                >
                  Drawer
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </div>,
      );

      // Synthetic swipe: opens the drawer and arms the release guard without synthesizing the
      // trailing click (`fireEvent` does not), leaving the guard waiting for it.
      await swipeUp(screen.getByTestId('swipe-area'), 120, 40);
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

      window.addEventListener('pointerdown', stopPointerDown, true);
      // `force` skips Playwright's actionability check; the drawer's internal backdrop
      // intercepts the click, which is exactly where a release click would land.
      await userEvent.click(screen.getByTestId('outside-target'), { force: true });
      window.removeEventListener('pointerdown', stopPointerDown, true);

      await nextMacrotask();
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

      // The guard is consumed and restored, so a deliberate outside press now dismisses.
      await userEvent.click(screen.getByTestId('outside-target'), { force: true });

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    } finally {
      window.removeEventListener('pointerdown', stopPointerDown, true);
    }
  });

  it('allows a later click-only activation to dismiss after a swipe', async () => {
    const { user } = await render(
      <>
        <button type="button">Outside</button>
        <Drawer.Root modal={false}>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" initialFocus={false}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </>,
    );

    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();

    await swipeUp(screen.getByTestId('swipe-area'), 120, 40);
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    expect(outside).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('allows a later pointerless virtual click to dismiss when the release has no click', async () => {
    await render(
      <>
        <button type="button">Outside</button>
        <Drawer.Root modal={false}>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" initialFocus={false}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </>,
    );

    await swipeUp(screen.getByTestId('swipe-area'), 120, 40, { input: 'touch' });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    eventUtilsMockState.forceVirtualClick = true;
    try {
      const virtualClick = new MouseEvent('click', { bubbles: true, detail: 1 });
      Object.defineProperty(virtualClick, 'pointerType', { value: '' });
      await fireEvent(screen.getByRole('button', { name: 'Outside' }), virtualClick);
    } finally {
      eventUtilsMockState.forceVirtualClick = false;
    }

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('re-enables outside press dismissal after an interrupted swipe-open gesture', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 119,
      buttons: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 80,
      buttons: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    expect(swipeArea).toHaveAttribute('data-open', '');

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 60,
      buttons: 2,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await nextMacrotask();
    await flushMicrotasks();

    await pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('re-enables outside press dismissal after a context menu interrupts swipe-open', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 119,
      buttons: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 80,
      buttons: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 60,
      buttons: 2,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    await fireEvent.contextMenu(swipeArea, {
      button: 2,
      clientX: 10,
      clientY: 60,
    });

    await nextMacrotask();
    await flushMicrotasks();

    await pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('uses a size-based swipe threshold by default', async () => {
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup" style={{ height: '200px' }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');
    const slowSwipe = {
      // Step the gesture past the flick-velocity window (`MAX_RELEASE_VELOCITY_AGE_MS`, 80ms) so
      // distance decides the outcome. Expressed on the swipe's own timeline rather than a real
      // sleep, which previously cleared the threshold by a single millisecond.
      timeStepMs: 100,
      async beforeRelease() {
        const popup = await screen.findByTestId('popup');
        Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });
      },
    };

    await swipeUp(swipeArea, 200, 130, slowSwipe);

    expect(swipeArea).toHaveAttribute('data-closed', '');

    await swipeUp(swipeArea, 200, 80, slowSwipe);

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('keeps the swipe-area movement on the popup when re-grabbed during close', async () => {
    // Regression guard for the swipe-area re-grab flash. When the swipe area drives the open, the
    // popup's `--drawer-swipe-movement-*` are written imperatively by `applySwipeMovement`, but
    // the viewport's open-reset effect would otherwise zero them
    // (`resetSwipe` -> `syncDragStyles(false)`) on the same commit that flips `open` true,
    // flashing the popup fully open for a frame. The shared `swipeAreaActiveRef` must make the
    // viewport skip that reset while the swipe area owns the gesture.
    //
    // The flash only reproduces on a *re-grab*, i.e. when the popup is already mounted as the open
    // commit lands. A real exit animation keeps the popup mounted (`mounted` stays true) through
    // the close, so the re-grab below drives a fresh open while it is still in the DOM.
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    // Base UI's exit lasts 200 ms. This exit lasts 100 s, so the popup stays in its exit until
    // the case grabs it again, and the case waits for no state that a timer ends.
    const style = `
      @keyframes swipe-regrab-exit {
        to {
          opacity: 0;
        }
      }

      .swipe-regrab-popup {
        height: 200px;
      }

      .swipe-regrab-popup[data-ending-style] {
        animation: swipe-regrab-exit 100s;
      }
    `;

    try {
      await render(
        <div>
          <style>{style}</style>
          <Drawer.Root>
            <Drawer.SwipeArea data-testid="swipe-area" />
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup class="swipe-regrab-popup" data-testid="popup">
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </div>,
      );

      const swipeArea = screen.getByTestId('swipe-area');

      await swipeUp(swipeArea, 220, 20);
      expect(swipeArea).toHaveAttribute('data-open', '');

      const popup = screen.getByTestId('popup');

      // Begin closing; the exit animation keeps the popup mounted while it plays.
      screen.getByRole('button', { name: 'Close' }).click();
      await flushMicrotasks();
      await waitFor(() => {
        expect(popup).toHaveAttribute('data-ending-style');
      });

      // Re-grab while the popup is still mounted mid-exit. A single move that locks the direction,
      // re-opens the drawer, and writes the movement (200 - 80 = 120px of remaining travel) on the
      // commit that flips `open` back to true.
      await fireEvent.pointerDown(swipeArea, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 10,
        clientY: 120,
        pointerType: 'mouse',
      });
      await flushMicrotasks();

      await fireEvent.pointerMove(swipeArea, {
        pointerId: 1,
        clientX: 10,
        clientY: 40,
        buttons: 1,
        pointerType: 'mouse',
      });
      await flushMicrotasks();

      expect(swipeArea).toHaveAttribute('data-open', '');
      // The viewport's open-reset must not have clobbered the swipe area's value back to `0px`.
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('120px');
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    }
  });

  it('opens on a quick flick whose only move is already released (buttons: 0)', async () => {
    // On a fast flick — especially on a low-refresh-rate display — the pointer can be lifted before
    // the first `pointermove` is sampled, so the single move arrives with `buttons: 0` and no
    // preceding pressed move. It must still commit the swipe-open instead of being discarded.
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    await firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    // No trailing `pointerup` follows; the released move must finish the gesture by itself.
    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');

    await pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('commits a released-move quick flick exactly once when a real pointerup trails it', async () => {
    // The `buttons: 0` move finishes the gesture by itself, but a real browser still delivers the
    // trailing `pointerup` afterwards. That second `handleEnd` must be a no-op: the flick stays open
    // and does not re-commit the release (no double open-change, no spurious close).
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    await firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);

    // The trailing `pointerup` a real browser still delivers must not re-run the release.
    await firePointer.up(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 32,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
  });

  it('opens on a quick flick that lands its whole travel in a single touch move', async () => {
    // A fast touch flick on a low-refresh-rate display can produce a single `touchmove` carrying
    // the entire travel between `touchstart` and `touchend`. The first-move latency calibration
    // must not discard it for the swipe-area (which doesn't track a dragged element).
    await render(
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await fireTouch.start(swipeArea, { touches: [{ clientX: 10, clientY: 120 }] });
    await flushMicrotasks();

    await fireTouch.move(swipeArea, { touches: [{ clientX: 10, clientY: 40 }] });
    await flushMicrotasks();

    await fireTouch.end(swipeArea, { changedTouches: [{ clientX: 10, clientY: 40 }] });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('does not open on an in-place press-release without movement', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    // Released in place: a `buttons: 0` move with no displacement must not open the drawer.
    await firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    await firePointer.up(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 32,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not open a horizontal drawer on a stationary pointer move', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
      </Drawer.Root>,
    );

    const swipeArea = screen.getByTestId('swipe-area');

    await fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });

    expect(handleOpenChange).not.toHaveBeenCalled();

    await fireEvent.pointerUp(swipeArea, {
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('hydrates the swipe areas of a closed and an open drawer with no message', async () => {
    const serverHtml = await renderOnServer(
      'src/drawer/swipe-area/DrawerSwipeAreaHydration.test.vue',
      {},
    );
    const template = document.createElement('template');
    template.innerHTML = serverHtml;
    const closed = template.content.querySelector<HTMLElement>('[data-testid="closed-swipe-area"]');
    const open = template.content.querySelector<HTMLElement>('[data-testid="open-swipe-area"]');
    expect(closed?.getAttribute('role')).toBe('presentation');
    expect(closed?.getAttribute('aria-hidden')).toBe('true');
    expect(closed?.getAttribute('data-closed')).toBe('');
    expect(closed?.getAttribute('data-swipe-direction')).toBe('up');
    expect(closed?.id).not.toBe('');
    expect(closed?.style.touchAction).toBe('pan-x');
    expect(closed?.style.pointerEvents).toBe('');
    expect(open?.getAttribute('data-open')).toBe('');
    expect(open?.getAttribute('data-swipe-direction')).toBe('left');
    expect(open?.style.touchAction).toBe('pan-y');
    expect(open?.style.pointerEvents).toBe('none');

    await hydrate(DrawerSwipeAreaHydration, { serverHtml });
  });

  it('VUE-57: removes the swipe styles of the gesture when it unmounts during the gesture', async () => {
    const shown = shallowRef(true);
    await render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root modal={false}>
          {shown.value && <Drawer.SwipeArea data-testid="swipe-area" />}
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));

    await startOpeningSwipe(screen.getByTestId('swipe-area'));
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const indent = screen.getByTestId('indent');
    expect(popup).toHaveAttribute('data-swiping', '');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('60px');
    expect(popup.style.transition).toBe('none');
    expect(backdrop).toHaveAttribute('data-swiping', '');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.6');
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.4');

    shown.value = false;
    await flushMicrotasks();

    expect(popup).toBeVisible();
    expect(popup).not.toHaveAttribute('data-swiping');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(popup.style.transition).toBe('');
    expect(backdrop).not.toHaveAttribute('data-swiping');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  it('renders a presentation element with the touch action of its direction, and takes no pointer event while it cannot open the drawer', async () => {
    const open = shallowRef(false);
    const disabled = shallowRef(false);
    const swipeDirection = shallowRef<'up' | 'left' | undefined>(undefined);
    await render(() => (
      <Drawer.Root open={open.value}>
        <Drawer.SwipeArea
          data-testid="swipe-area"
          disabled={disabled.value}
          swipeDirection={swipeDirection.value}
        />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    const swipeArea = screen.getByTestId('swipe-area');

    expect(swipeArea).toHaveAttribute('role', 'presentation');
    expect(swipeArea).toHaveAttribute('aria-hidden', 'true');
    expect(swipeArea).toHaveAttribute('data-swipe-direction', 'up');
    expect(swipeArea.style.touchAction).toBe('pan-x');
    expect(swipeArea.style.pointerEvents).toBe('');

    swipeDirection.value = 'left';
    await flushMicrotasks();
    expect(swipeArea).toHaveAttribute('data-swipe-direction', 'left');
    expect(swipeArea.style.touchAction).toBe('pan-y');

    disabled.value = true;
    await flushMicrotasks();
    expect(swipeArea).toHaveAttribute('data-disabled', '');
    expect(swipeArea.style.pointerEvents).toBe('none');

    disabled.value = false;
    open.value = true;
    await flushMicrotasks();
    expect(swipeArea).not.toHaveAttribute('data-disabled');
    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(swipeArea.style.pointerEvents).toBe('none');
  });

  it('writes the swipe movement to the popup, the backdrop and the indent, and clears it at the release', async () => {
    await render(
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
          <Drawer.Portal keepMounted>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="popup"
                v-slots={{
                  render: renderWithSize({ offsetHeight: 100, offsetWidth: 100 }, 'Drawer'),
                }}
              />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>,
    );

    const swipeArea = screen.getByTestId('swipe-area');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const indent = screen.getByTestId('indent');

    await swipeLeft(swipeArea, 200, 100, {
      async beforeRelease({ nextTimeStamp }) {
        expect(popup).toHaveAttribute('data-swiping', '');

        await firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: 150,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('50px');
        expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
        expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');

        await firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
      },
    });

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
    expect(popup).not.toHaveAttribute('data-swiping');
    expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
  });

  it('opens at the release of a fast swipe shorter than half the popup', async () => {
    const handleOpenChange = vi.fn();
    await render(
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup v-slots={{ render: renderWithSize({ offsetHeight: 200 }, 'Drawer') }} />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await swipeUp(screen.getByTestId('swipe-area'), 200, 170);

    expect(screen.getByTestId('swipe-area')).toHaveAttribute('data-open', '');
    expect(
      handleOpenChange.mock.calls.map(([nextOpen, details]) => [nextOpen, details.reason]),
    ).toEqual([[true, 'swipe']]);
  });

  it('VUE-5: ends the gesture and lets an outside press close the drawer while KeepAlive holds the swipe area', async () => {
    const shown = shallowRef(true);
    const Held = defineComponent({
      name: 'Held',
      setup: () => () => <Drawer.SwipeArea data-testid="swipe-area" />,
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
    await render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));

    await startOpeningSwipe(screen.getByTestId('swipe-area'));
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    expect(popup).toHaveAttribute('data-swiping', '');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('60px');
    expect(backdrop).toHaveAttribute('data-swiping', '');

    shown.value = false;
    await flushMicrotasks();
    expect(popup).not.toHaveAttribute('data-swiping');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(backdrop).not.toHaveAttribute('data-swiping');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(screen.getByTestId('indent').style.getPropertyValue('--drawer-swipe-progress')).toBe(
      '0',
    );

    await pressOutside();
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    shown.value = true;
    await flushMicrotasks();
    const swipeArea = screen.getByTestId('swipe-area');
    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');

    await swipeUp(swipeArea, 120, 40);
    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('lets an outside press close the drawer after it unmounts during a gesture', async () => {
    const shown = shallowRef(true);
    await render(() => (
      <Drawer.Root>
        {shown.value && <Drawer.SwipeArea data-testid="swipe-area" />}
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    await startOpeningSwipe(screen.getByTestId('swipe-area'));
    expect(screen.getByTestId('popup')).toBeVisible();

    shown.value = false;
    await flushMicrotasks();

    await pressOutside();
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });
});
