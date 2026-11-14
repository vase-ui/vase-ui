import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
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
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';
import * as Drawer from '../index.parts';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import DrawerSwipeAreaHydration from './DrawerSwipeAreaHydration.test.vue';

type Point = {
  x: number;
  y: number;
};

type SwipeContext = {
  /** Advances the gesture timeline by one step and returns the new timestamp. */
  nextTimeStamp: () => number;
};

type SwipeOptions = {
  // Receives the gesture's timeline so any event it injects stays on the same clock as the rest of
  // the swipe. Firing an untimed event here would stamp it off the real clock, landing it out of
  // order against the synthetic timestamps and skipping the release-velocity refinement.
  beforeRelease?: (context: SwipeContext) => Promise<unknown> | unknown;
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

  await firePointer.down(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: start.x,
    clientY: start.y,
    pointerType: 'mouse',
    timeStamp,
  });

  await flushMicrotasks();

  timeStamp += timeStepMs;

  await firePointer.move(element, {
    pointerId: 1,
    clientX: stepX,
    clientY: stepY,
    buttons: 1,
    pointerType: 'mouse',
    timeStamp,
  });

  await flushMicrotasks();

  timeStamp += timeStepMs;

  await firePointer.move(element, {
    pointerId: 1,
    clientX: end.x,
    clientY: end.y,
    buttons: 1,
    pointerType: 'mouse',
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
    pointerType: 'mouse',
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

// The click that a browser sends after the `pointerup` of the gesture. It has no `pointerdown` of
// its own.
async function releaseClick() {
  const click = new MouseEvent('click', { bubbles: true, detail: 1 });
  Object.defineProperty(click, 'pointerType', { value: 'mouse' });
  await fireEvent(document.body, click);
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

function setSize(element: HTMLElement, size: { offsetWidth?: number; offsetHeight?: number }) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

// The popup reports its height to the root, and the root gives it to each part as the frontmost
// height.
const PopupHeightReport = defineComponent({
  props: { height: { type: Number, required: true } },
  setup(props) {
    useDrawerRootContext().onPopupHeightChange(props.height);
    return () => null;
  },
});

// A popup that renders the swipe movement in its style, as `Drawer.Popup` renders the drag styles
// of the viewport.
const MovementStylePopup = defineComponent({
  inheritAttrs: false,
  setup(_props, { attrs }) {
    const store = useDialogRootContext();
    let ownElement: HTMLElement | null = null;
    function setPopupElement(element: unknown) {
      const popup = element as HTMLElement | null;
      if (popup === ownElement) {
        return;
      }
      ownElement = popup;
      store.context.popupRef.value = popup;
      store.set('popupElement', popup);
    }

    return () => (
      <div
        {...attrs}
        ref={setPopupElement}
        hidden={store.select('mounted') ? undefined : true}
        style={{ '--drawer-swipe-movement-y': '0px' }}
      />
    );
  },
});

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

  describe('with a test popup', () => {
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
          <DialogPopupPart />
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
            <PopupHeightReport height={100} />
            <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
            <Drawer.Backdrop data-testid="backdrop" />
            <DialogPopupPart data-testid="popup" keepMounted />
          </Drawer.Root>
        </Drawer.Provider>,
      );

      const swipeArea = screen.getByTestId('swipe-area');
      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');
      const indent = screen.getByTestId('indent');
      setSize(popup, { offsetHeight: 100, offsetWidth: 100 });
      popup.style.transition = 'opacity 1s';

      await swipeLeft(swipeArea, 200, -50, {
        async beforeRelease({ nextTimeStamp }) {
          expect(
            Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-x')),
          ).toBeCloseTo(-Math.sqrt(150));
          expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
          expect(popup.style.transition).toBe('none');
          expect(popup).toHaveAttribute('data-swiping', '');
          expect(backdrop).toHaveAttribute('data-swiping', '');
          expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
          expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('100px');
          expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');
          expect(indent.style.getPropertyValue('--drawer-height')).toBe('100px');

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
            clientX: 200,
            clientY: 10,
            pointerType: 'mouse',
            timeStamp: nextTimeStamp(),
          });
          expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
          expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
          expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('');

          await firePointer.move(swipeArea, {
            buttons: 1,
            pointerId: 1,
            clientX: -50,
            clientY: 10,
            pointerType: 'mouse',
            timeStamp: nextTimeStamp(),
          });
        },
      });

      expect(swipeArea).toHaveAttribute('data-open', '');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('');
      expect(popup.style.transition).toBe('opacity 1s');
      expect(popup).not.toHaveAttribute('data-swiping');
      expect(backdrop).not.toHaveAttribute('data-swiping');
      expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('');
      expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
    });

    it('gives the backdrop and the indent no drawer height while the frontmost height is 0', async () => {
      await render(
        <Drawer.Provider>
          <Drawer.Indent data-testid="indent" />
          <Drawer.Root>
            <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
            <Drawer.Backdrop data-testid="backdrop" />
            <DialogPopupPart data-testid="popup" keepMounted />
          </Drawer.Root>
        </Drawer.Provider>,
      );
      setSize(screen.getByTestId('popup'), { offsetHeight: 0, offsetWidth: 100 });

      await swipeLeft(screen.getByTestId('swipe-area'), 100, 40, {
        beforeRelease() {
          expect(screen.getByTestId('backdrop')).toHaveAttribute('data-swiping', '');
          expect(screen.getByTestId('backdrop').style.getPropertyValue('--drawer-height')).toBe('');
          expect(screen.getByTestId('indent').style.getPropertyValue('--drawer-height')).toBe('');
        },
      });
    });

    it('measures the distance to the open position from the transform of the popup', async () => {
      await render(
        <Drawer.Root swipeDirection="left">
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="right" />
          <DialogPopupPart data-testid="popup" style={{ transform: 'matrix(1, 0, 0, 1, 60, 0)' }}>
            Drawer
          </DialogPopupPart>
        </Drawer.Root>,
      );
      const swipeArea = screen.getByTestId('swipe-area');

      await firePointer.down(swipeArea, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 10,
        pointerType: 'mouse',
        timeStamp: 1,
      });
      await firePointer.move(swipeArea, {
        buttons: 1,
        pointerId: 1,
        clientX: 1,
        clientY: 10,
        pointerType: 'mouse',
        timeStamp: 17,
      });
      const popup = screen.getByTestId('popup');
      setSize(popup, { offsetWidth: 100 });

      await firePointer.move(swipeArea, {
        buttons: 1,
        pointerId: 1,
        clientX: 40,
        clientY: 10,
        pointerType: 'mouse',
        timeStamp: 33,
      });
      expect(
        Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-x')),
      ).toBeCloseTo(-20);

      await firePointer.up(swipeArea, {
        pointerId: 1,
        clientX: 40,
        clientY: 10,
        pointerType: 'mouse',
        timeStamp: 49,
      });
      expect(swipeArea).toHaveAttribute('data-open', '');
    });

    it.each([
      { name: 'a slow swipe shorter than half the popup', endY: 130, timeStepMs: 100, open: false },
      { name: 'a slow swipe of half the popup', endY: 100, timeStepMs: 100, open: true },
      { name: 'a fast swipe shorter than half the popup', endY: 170, timeStepMs: 16, open: true },
    ])('decides the open at the release of $name', async ({ endY, timeStepMs, open }) => {
      const handleOpenChange = vi.fn();
      await render(
        <Drawer.Root onOpenChange={handleOpenChange}>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <DialogPopupPart data-testid="popup" keepMounted />
        </Drawer.Root>,
      );
      setSize(screen.getByTestId('popup'), { offsetHeight: 200 });

      await swipeUp(screen.getByTestId('swipe-area'), 200, endY, { timeStepMs });

      expect(screen.getByTestId('swipe-area')).toHaveAttribute(
        open ? 'data-open' : 'data-closed',
        '',
      );
      expect(
        handleOpenChange.mock.calls.map(([nextOpen, details]) => [nextOpen, details.reason]),
      ).toEqual(
        open
          ? [[true, 'swipe']]
          : [
              [true, 'swipe'],
              [false, 'swipe'],
            ],
      );
    });

    it('does not apply or close swipe state when a controlled parent rejects the open', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Drawer.Root open={false} onOpenChange={handleOpenChange}>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <DialogPopupPart data-testid="popup" keepMounted />
        </Drawer.Root>,
      );
      const popup = screen.getByTestId('popup');
      setSize(popup, { offsetHeight: 100 });

      await swipeUp(screen.getByTestId('swipe-area'), 120, 110, {
        startTimeMs: 1000,
        timeStepMs: 1000,
      });

      expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(handleOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
      expect(popup).not.toHaveAttribute('data-swiping');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('');
    });

    it('keeps the movement on the popup when the open renders the popup again', async () => {
      await render(
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <MovementStylePopup data-testid="popup" />
        </Drawer.Root>,
      );
      const swipeArea = screen.getByTestId('swipe-area');
      const popup = screen.getByTestId('popup');
      setSize(popup, { offsetHeight: 100 });

      await firePointer.down(swipeArea, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 10,
        clientY: 120,
        pointerType: 'mouse',
        timeStamp: 1,
      });
      await firePointer.move(swipeArea, {
        buttons: 1,
        pointerId: 1,
        clientX: 10,
        clientY: 119,
        pointerType: 'mouse',
        timeStamp: 17,
      });

      expect(swipeArea).toHaveAttribute('data-open', '');
      expect(popup).not.toHaveAttribute('hidden');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('99px');

      await firePointer.up(swipeArea, {
        pointerId: 1,
        clientX: 10,
        clientY: 119,
        pointerType: 'mouse',
        timeStamp: 33,
      });
    });

    it.each([
      {
        name: 'a release',
        end: (swipeArea: HTMLElement) =>
          fireEvent.pointerUp(swipeArea, {
            pointerId: 1,
            clientX: 0,
            clientY: 40,
            pointerType: 'mouse',
          }),
      },
      {
        name: 'a canceled gesture',
        end: (swipeArea: HTMLElement) =>
          fireEvent.pointerCancel(swipeArea, { pointerId: 1, pointerType: 'mouse' }),
      },
    ])(
      'ignores the release click after $name, and closes the drawer at the next outside press',
      async ({ end }) => {
        await render(
          <Drawer.Root>
            <Drawer.SwipeArea data-testid="swipe-area" />
            <DialogPopupPart data-testid="popup">Drawer</DialogPopupPart>
          </Drawer.Root>,
        );
        const swipeArea = screen.getByTestId('swipe-area');

        await startOpeningSwipe(swipeArea, 40);
        expect(screen.getByTestId('popup')).toHaveAttribute('data-swiping', '');

        await end(swipeArea);
        await nextMacrotask();
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');

        await releaseClick();
        await nextMacrotask();
        expect(screen.getByTestId('popup')).toBeVisible();

        await pressOutside();

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        expect(swipeArea).toHaveAttribute('data-closed', '');
      },
    );

    it('lets a click with no pointer close the drawer after the release', async () => {
      await render(
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <DialogPopupPart data-testid="popup">Drawer</DialogPopupPart>
        </Drawer.Root>,
      );

      await swipeUp(screen.getByTestId('swipe-area'), 120, 40);
      expect(screen.getByTestId('popup')).toBeVisible();

      await fireEvent.click(document.body, { detail: 0 });

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });

    it('ends an opening gesture when the swipe area becomes disabled, and ignores its release click', async () => {
      const disabled = shallowRef(false);
      await render(() => (
        <Drawer.Provider>
          <Drawer.Indent data-testid="indent" />
          <Drawer.Root>
            <Drawer.SwipeArea data-testid="swipe-area" disabled={disabled.value} />
            <DialogPopupPart data-testid="popup">Drawer</DialogPopupPart>
          </Drawer.Root>
        </Drawer.Provider>
      ));
      const swipeArea = screen.getByTestId('swipe-area');

      await startOpeningSwipe(swipeArea);
      const popup = screen.getByTestId('popup');
      expect(popup).toHaveAttribute('data-swiping', '');
      expect(
        screen.getByTestId('indent').style.getPropertyValue('--drawer-swipe-progress'),
      ).not.toBe('0');

      disabled.value = true;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('data-swiping');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('');
      expect(screen.getByTestId('indent').style.getPropertyValue('--drawer-swipe-progress')).toBe(
        '0',
      );
      expect(swipeArea).toHaveAttribute('data-disabled', '');
      expect(swipeArea).not.toHaveAttribute('data-swiping');

      // The pointer is still down when `disabled` flips, so the gesture's eventual release
      // synthesizes a click with no fresh `pointerdown`. It must not dismiss the drawer the
      // gesture just opened.
      await releaseClick();
      await nextMacrotask();
      expect(popup).toBeVisible();

      await pressOutside();

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
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
            <Drawer.Backdrop data-testid="backdrop" />
            <DialogPopupPart data-testid="popup">Drawer</DialogPopupPart>
          </Drawer.Root>
        </Drawer.Provider>
      ));

      await startOpeningSwipe(screen.getByTestId('swipe-area'));
      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');
      expect(popup).toHaveAttribute('data-swiping', '');
      expect(backdrop).toHaveAttribute('data-swiping', '');

      shown.value = false;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('data-swiping');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('');
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
          <DialogPopupPart data-testid="popup">Drawer</DialogPopupPart>
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
});
