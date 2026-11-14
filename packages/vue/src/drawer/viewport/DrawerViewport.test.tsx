import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, Teleport, defineComponent, shallowRef, type VNodeChild } from 'vue';
import { Slider } from '@vase-ui/vue/slider';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import type { VaseUIEvent } from '../../internals/types';
import * as Drawer from '../index.parts';

type Point = { clientX: number; clientY: number };

function stubElementFromPoint(
  root: Document | ShadowRoot,
  getElement: (x: number, y: number) => Element | null,
) {
  const originalElementFromPoint = root.elementFromPoint;
  root.elementFromPoint = getElement;
  const restore = () => {
    root.elementFromPoint = originalElementFromPoint;
  };
  onTestFinished(restore);
  return restore;
}

function createTouch(target: EventTarget, point: Point): Touch | Point {
  try {
    return new Touch({ identifier: 1, target, ...point });
  } catch {
    // WebKit on a desktop cannot construct a `Touch`. The viewport reads the same members from the
    // point.
    return point;
  }
}

function setHeight(element: HTMLElement | null, value: number) {
  if (element) {
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value });
  }
}

function createNativeTouchMove(target: EventTarget, point: Point) {
  const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(touchMove, 'touches', {
    value: [createTouch(target, point)],
    configurable: true,
  });
  return touchMove;
}

function trackTouchMoveListeners() {
  const activeListeners = new Set<EventListenerOrEventListenerObject>();
  const addSpy = vi
    .spyOn(document, 'addEventListener')
    .mockImplementation(function addEventListener(this: Document, type, listener, options) {
      if (type === 'touchmove' && typeof options === 'object' && options.passive === false) {
        activeListeners.add(listener);
      }
      return EventTarget.prototype.addEventListener.call(this, type, listener, options);
    });
  const removeSpy = vi
    .spyOn(document, 'removeEventListener')
    .mockImplementation(function removeEventListener(this: Document, type, listener, options) {
      if (type === 'touchmove') {
        activeListeners.delete(listener);
      }
      return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
    });
  onTestFinished(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  return activeListeners;
}

describe('<Drawer.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>{node}</Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  it('registers the non-passive document touchmove listener only while open', async () => {
    const activeListeners = trackTouchMoveListeners();
    const open = shallowRef(false);

    await render(() => (
      <Drawer.Root open={open.value}>
        <Drawer.Portal keepMounted>
          <Drawer.Viewport>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    expect(activeListeners.size).toBe(0);

    open.value = true;
    await flushMicrotasks();
    expect(activeListeners.size).toBe(1);

    open.value = false;
    await flushMicrotasks();
    expect(activeListeners.size).toBe(0);
  });

  it('clears text selection on swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    stubElementFromPoint(document, () => popup);
    await fireEvent.pointerDown(viewport, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });

    expect(selection.rangeCount).toBe(0);
  });

  it('preserves text selection outside the popup when a swipe starts', async () => {
    await render(
      <div>
        <span data-testid="outside-text">Outside selection</span>
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const outsideText = screen.getByTestId('outside-text');
    const textNode = outsideText.firstChild;
    const selection = window.getSelection();
    expect(textNode).not.toBeNull();
    expect(selection).not.toBeNull();
    if (!textNode || !selection) {
      return;
    }

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 7);
    selection.removeAllRanges();
    selection.addRange(range);

    const popup = screen.getByTestId('popup');
    stubElementFromPoint(document, () => popup);
    await fireEvent.pointerDown(screen.getByTestId('viewport'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });

    expect(selection.rangeCount).toBe(1);
    // The page outside a modal drawer is inert, and `Selection.toString()` skips inert text.
    expect(selection.getRangeAt(0).toString()).toBe('Outside');
  });

  it('does not clear text selection on touch swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    stubElementFromPoint(document, () => popup);
    await fireTouch.start(viewport, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(selection.rangeCount).toBe(1);
  });

  it('starts touch swipes from interactive elements', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    stubElementFromPoint(document, () => button);
    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
  });

  it('uses shadow-root hit testing for touch swipe targets', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());

    await render(
      <Drawer.Root open>
        <Drawer.Portal container={shadowRoot}>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="target">Target</div>
              <div data-vase-ui-swipe-ignore data-testid="ignored">
                Ignore
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = shadowRoot.querySelector<HTMLElement>('[data-testid="target"]');
    const ignored = shadowRoot.querySelector<HTMLElement>('[data-testid="ignored"]');
    const backdrop = shadowRoot.querySelector<HTMLElement>('[data-testid="backdrop"]');
    expect(target).not.toBeNull();
    expect(ignored).not.toBeNull();
    expect(backdrop).not.toBeNull();
    if (!target || !ignored || !backdrop) {
      return;
    }

    // Returning an in-popup element from the document hit test would start the swipe if the
    // shadow root were not consulted, so this pins the shadow-root lookup rather than the
    // `contains()` rejection that a retargeted host would also trigger.
    stubElementFromPoint(document, () => target);
    let shadowTarget: Element = ignored;
    stubElementFromPoint(shadowRoot, () => shadowTarget);

    await fireTouch.start(ignored, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');

    await fireTouch.end(ignored, { changedTouches: [{ clientX: 0, clientY: 0 }] });
    shadowTarget = target;

    await fireTouch.start(target, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
  });

  it('starts a swipe inside a shadow root using real hit testing', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal container={shadowRoot}>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              style={{ position: 'fixed', top: '0', left: '0', width: '200px', height: '200px' }}
            >
              Content
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const popup = shadowRoot.querySelector<HTMLElement>('[data-testid="popup"]');
    const backdrop = shadowRoot.querySelector<HTMLElement>('[data-testid="backdrop"]');
    expect(popup).not.toBeNull();
    expect(backdrop).not.toBeNull();
    if (!popup || !backdrop) {
      return;
    }

    // No `elementFromPoint` stubbing: a real document hit test retargets the popup content to
    // the shadow host, which fails the `contains()` check in the swipe `canStart` guard, so
    // this only engages when the hit test runs against the shadow root.
    await fireTouch.start(popup, { touches: [{ clientX: 100, clientY: 100 }] });
    await fireTouch.move(popup, { touches: [{ clientX: 100, clientY: 125 }] });

    await waitFor(() => {
      expect(backdrop).toHaveAttribute('data-swiping', '');
    });

    await fireTouch.end(popup, { changedTouches: [{ clientX: 100, clientY: 125 }] });
  });

  it('clears the backdrop data-swiping attribute when the drawer unmounts mid-swipe', async () => {
    const { unmount } = await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    stubElementFromPoint(document, () => button);
    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');

    unmount();
    await flushMicrotasks();

    // The detached node keeps its attributes, so this asserts the cleanup removed
    // `data-swiping` from the backdrop that was mounted while swiping.
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('uses the event target for non-keyboard touch scroll arbitration', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <button type="button" data-testid="button">
                  Action
                </button>
                <div style={{ height: '120px' }} />
              </div>
              <div data-testid="other-scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const scroll = screen.getByTestId('scroll');
    const otherScroll = screen.getByTestId('other-scroll');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;
    Object.defineProperty(otherScroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(otherScroll, 'clientHeight', { value: 40, configurable: true });
    otherScroll.scrollTop = 40;

    let hitTestCount = 0;
    stubElementFromPoint(document, () => {
      hitTestCount += 1;
      return hitTestCount === 1 ? otherScroll : button;
    });

    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 40 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
  });

  it('scrolls instead of swiping when a touch drag starts on an SVG inside scrolled content', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 40;

    stubElementFromPoint(document, () => rect);

    await fireTouch.start(rect, { touches: [{ clientX: 0, clientY: 0 }] });
    const prevented = !(await fireTouch.move(rect, { touches: [{ clientX: 0, clientY: 40 }] }));
    await flushMicrotasks();

    expect(prevented).toBe(false);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start a mouse drag swipe from an SVG inside scrollable content', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    stubElementFromPoint(document, () => rect);

    await fireEvent.pointerDown(rect, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(viewport, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 40,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('dismisses with a touch swipe down that starts on an SVG inside a top-edge scroll container', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: '120px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const rect = screen.getByTestId('rect');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

    stubElementFromPoint(document, () => rect);

    await fireTouch.start(rect, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(rect, { touches: [{ clientX: 0, clientY: 140 }] });

    expect(backdrop).toHaveAttribute('data-swiping', '');

    await fireTouch.end(rect, { changedTouches: [{ clientX: 0, clientY: 140 }] });
    await flushMicrotasks();

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('allows clicks on non-interactive elements without data-base-ui-swipe-ignore', async () => {
    const handleClick = vi.fn();
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" onClick={handleClick}>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    stubElementFromPoint(document, () => target);

    await fireTouch.start(target, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireEvent.pointerDown(target, { pointerType: 'touch' });
    await fireTouch.end(target, { changedTouches: [{ clientX: 0, clientY: 0 }] });
    await fireEvent.click(target, { detail: 1 });
    await flushMicrotasks();

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start touch swipes from elements with data-base-ui-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" data-vase-ui-swipe-ignore>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');

    await fireTouch.start(target, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(target, { touches: [{ clientX: 0, clientY: 40 }] });
    await fireTouch.end(target, { changedTouches: [{ clientX: 0, clientY: 40 }] });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  describe('data-base-ui-swipe-ignore axis values', () => {
    async function renderAxisDrawer(
      swipeDirection: 'down' | 'right',
      children: VNodeChild,
      handleOpenChange: (open: boolean, details: Drawer.Root.ChangeEventDetails) => void,
    ) {
      await render(
        <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection={swipeDirection}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">{children}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );
    }

    async function swipe(target: HTMLElement, points: readonly Point[]) {
      const restore = stubElementFromPoint(document, () => target);

      try {
        await fireTouch.start(target, { touches: [{ clientX: 100, clientY: 100 }] });
        const results: boolean[] = [];
        for (const point of points) {
          results.push(await fireTouch.move(target, { touches: [point] }));
        }
        return results;
      } finally {
        restore();
      }
    }

    async function endSwipe(target: HTMLElement, point: Point) {
      await fireTouch.end(target, { changedTouches: [point] });
    }

    it.each([
      ['down', 'y', { clientX: 100, clientY: 140 }],
      ['right', 'x', { clientX: 140, clientY: 100 }],
    ] as const)(
      'ignores %s touch swipes from elements with the drawer axis value "%s"',
      async (swipeDirection, axis, end) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          <div data-testid="target" data-vase-ui-swipe-ignore={axis}>
            Carousel
          </div>,
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        expect(await swipe(target, [end])).toEqual([true]);
        expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');

        await endSwipe(target, end);
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['down', 'x', { clientX: 103, clientY: 101 }, { clientX: 140, clientY: 104 }],
      ['right', 'y', { clientX: 101, clientY: 103 }, { clientX: 104, clientY: 140 }],
    ] as const)(
      'hands cross-axis drags in %s drawers to elements with the value "%s"',
      async (swipeDirection, axis, ambiguous, crossAxis) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          <div data-testid="target" data-vase-ui-swipe-ignore={axis}>
            Carousel
          </div>,
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        const popup = screen.getByTestId('popup');
        const handleTargetTouchMove = vi.fn();
        target.addEventListener('touchmove', handleTargetTouchMove);
        expect(await swipe(target, [ambiguous, crossAxis])).toEqual([true, true]);
        expect(handleTargetTouchMove).toHaveBeenCalledTimes(2);
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');

        await endSwipe(target, crossAxis);
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each(['marked', 'scrollable'] as const)(
      'does not swipe or settle snap points while a %s cross-axis target handles the drag',
      async (kind) => {
        const handleSnapPointChange = vi.fn();
        await render(
          <Drawer.Root open snapPoints={[200, 360]} onSnapPointChange={handleSnapPointChange}>
            <Drawer.Portal>
              <Drawer.Backdrop data-testid="backdrop" />
              <Drawer.Viewport>
                <Drawer.Popup data-testid="popup">
                  <div
                    data-testid="target"
                    data-vase-ui-swipe-ignore={kind === 'marked' ? 'x' : undefined}
                    style={kind === 'scrollable' ? { overflowX: 'auto' } : undefined}
                  >
                    Carousel
                  </div>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>,
        );

        const target = screen.getByTestId('target');
        if (kind === 'scrollable') {
          Object.defineProperty(target, 'scrollWidth', { value: 400, configurable: true });
          Object.defineProperty(target, 'clientWidth', { value: 100, configurable: true });
        }

        const crossAxis = { clientX: 140, clientY: 104 };
        expect(await swipe(target, [{ clientX: 103, clientY: 101 }, crossAxis])).toEqual([
          true,
          true,
        ]);
        expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');

        await endSwipe(target, crossAxis);
        await flushMicrotasks();

        expect(handleSnapPointChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'down',
        'x',
        [
          { clientX: 101, clientY: 103 },
          { clientX: 102, clientY: 140 },
          { clientX: 102, clientY: 200 },
        ],
      ],
      [
        'right',
        'y',
        [
          { clientX: 103, clientY: 101 },
          { clientX: 140, clientY: 102 },
          { clientX: 200, clientY: 102 },
        ],
      ],
    ] as const)(
      'still swipes %s drawers from elements with the cross-axis value "%s"',
      async (swipeDirection, axis, points) => {
        const handleOpenChange = vi.fn();
        await renderAxisDrawer(
          swipeDirection,
          <div data-testid="target" data-vase-ui-swipe-ignore={axis}>
            Carousel
          </div>,
          handleOpenChange,
        );

        const target = screen.getByTestId('target');
        expect(await swipe(target, [...points])).toEqual([true, false, false]);

        await endSwipe(target, points[2]);
        await flushMicrotasks();

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange.mock.calls[0][0]).toBe(false);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe('swipe');
      },
    );

    it('keeps an ancestor that ignores all directions in effect over a nested axis value', async () => {
      const handleOpenChange = vi.fn();
      await renderAxisDrawer(
        'down',
        <div data-vase-ui-swipe-ignore>
          <div data-testid="target" data-vase-ui-swipe-ignore="x">
            Carousel
          </div>
        </div>,
        handleOpenChange,
      );

      const target = screen.getByTestId('target');
      const end = { clientX: 100, clientY: 140 };
      expect(await swipe(target, [end])).toEqual([true]);

      await endSwipe(target, end);
      await flushMicrotasks();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });
  });

  it('does not prevent native touch scrolling in portaled descendants', async () => {
    const portalContainer = document.createElement('div');
    document.body.append(portalContainer);
    onTestFinished(() => portalContainer.remove());

    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>Content</Drawer.Content>
              <Teleport to={portalContainer}>
                <div data-testid="portaled-popup">Portaled popup</div>
              </Teleport>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const portaledPopup = screen.getByTestId('portaled-popup');
    stubElementFromPoint(document, () => portaledPopup);

    await fireTouch.start(portaledPopup, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchMove = createNativeTouchMove(portaledPopup, { clientX: 0, clientY: 40 });
    portaledPopup.dispatchEvent(touchMove);

    expect(touchMove.defaultPrevented).toBe(false);
  });

  it('still allows touch swipes from elements with legacy data-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="target" data-swipe-ignore>
                Action
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    stubElementFromPoint(document, () => target);

    await fireTouch.start(target, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(target, { touches: [{ clientX: 0, clientY: 40 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');

    await fireTouch.end(target, { changedTouches: [{ clientX: 0, clientY: 80 }] });
    await flushMicrotasks();

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not start non-touch swipes from Drawer.Content', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target">Action</div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    stubElementFromPoint(document, () => target);

    await fireEvent.pointerDown(target, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not jump when touch starts outside the popup and then enters it', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });
    stubElementFromPoint(document, (_x, y) => (y < 100 ? viewport : popup));

    await fireTouch.start(viewport, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(viewport, { touches: [{ clientX: 0, clientY: 120 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
    expect(Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'))).toBe(0);
  });

  it('dismisses when touch starts outside the popup, then continues swiping down inside it', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });
    stubElementFromPoint(document, (_x, y) => (y < 100 ? viewport : popup));

    await fireTouch.start(viewport, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(viewport, { touches: [{ clientX: 0, clientY: 120 }] });
    await fireTouch.move(viewport, { touches: [{ clientX: 0, clientY: 170 }] });
    await fireTouch.end(viewport, { changedTouches: [{ clientX: 0, clientY: 170 }] });
    await flushMicrotasks();

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('treats pen interactions on Drawer.Content as non-touch swipes', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <button type="button" data-testid="button">
                  Action
                </button>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');
    stubElementFromPoint(document, () => button);

    const pointerDownEvent = new Event('pointerdown', {
      bubbles: true,
      cancelable: true,
    }) as PointerEvent;

    Object.defineProperties(pointerDownEvent, {
      button: { value: 0 },
      buttons: { value: 1 },
      pointerId: { value: 1 },
      pointerType: { value: 'pen' },
      clientX: { value: 0 },
      clientY: { value: 0 },
    });

    await fireEvent(button, pointerDownEvent);
    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const prevented = await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 10 }] });

    expect(prevented).toBe(true);
  });

  it('does not mark nested drawers as swiping until movement passes the threshold', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport data-testid="parent-viewport">
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport data-testid="child-viewport">
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const parentViewport = screen.getByTestId('parent-viewport');
    const childViewport = screen.getByTestId('child-viewport');
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', { value: 200, configurable: true });
    stubElementFromPoint(document, () => childPopup);

    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(parentViewport).not.toHaveAttribute('data-nested-dialog-open');
    expect(childViewport).not.toHaveAttribute('data-nested-dialog-open');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');

    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 5 }] });
    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 20 }] });
    await flushMicrotasks();

    expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');
  });

  it('clears nested swiping when a nested drawer swipe is reversed before release', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', { value: 200, configurable: true });
    stubElementFromPoint(document, () => childPopup);

    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 5 }] });
    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 20 }] });
    await flushMicrotasks();

    expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');

    await fireTouch.move(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');
    expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  it('prevents touchmove at scroll top when swiping down on scrollable content', async () => {
    const handleTouchMove = vi.fn();

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchmove={handleTouchMove}
                style={{ overflowY: 'auto', maxHeight: '40px' }}
              >
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    await fireTouch.start(scroll, { touches: [{ clientX: 0, clientY: 0 }] });
    const prevented = await fireTouch.move(scroll, { touches: [{ clientX: 0, clientY: 10 }] });

    expect(prevented).toBe(false);
    expect(handleTouchMove).not.toHaveBeenCalled();
  });

  it('prevents touchmove at scroll bottom when swiping up on scrollable content', async () => {
    await render(
      <Drawer.Root open swipeDirection="up">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 80;
    stubElementFromPoint(document, () => scroll);

    await fireTouch.start(scroll, { touches: [{ clientX: 0, clientY: 20 }] });

    const touchMove = createNativeTouchMove(scroll, { clientX: 0, clientY: 10 });
    scroll.dispatchEvent(touchMove);
    await flushMicrotasks();

    expect(touchMove.defaultPrevented).toBe(true);
    expect(backdrop).toHaveAttribute('data-swiping');
  });

  it('prevents touchmove when a scrollable ancestor wraps the popup at the top', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
              <Drawer.Popup>
                <Drawer.Content>
                  <span data-testid="item">Scrollable content</span>
                </Drawer.Content>
              </Drawer.Popup>
            </div>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    const item = screen.getByTestId('item');
    stubElementFromPoint(document, () => item);

    await fireTouch.start(item, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchMove = createNativeTouchMove(item, { clientX: 0, clientY: 10 });
    item.dispatchEvent(touchMove);
    await flushMicrotasks();

    expect(touchMove.defaultPrevented).toBe(true);
    expect(backdrop).toHaveAttribute('data-swiping');
  });

  it('starts a swipe away from the page scroll edge when the body is a scroll container', async () => {
    const html = document.documentElement;
    const { body } = document;
    const previousHtmlStyle = html.style.cssText;
    const previousBodyStyle = body.style.cssText;
    // A common reset that turns `body` into a real scroll container instead of letting its
    // overflow propagate to the viewport.
    html.style.cssText = 'height: 100%; overflow-y: auto';
    body.style.cssText = 'height: 100%; overflow-y: auto';
    onTestFinished(() => {
      html.style.cssText = previousHtmlStyle;
      body.style.cssText = previousBodyStyle;
    });

    await render(
      <>
        <div style={{ height: '5000px' }} />
        <Drawer.Root open modal={false} swipeDirection="down" snapPoints={[300, 100]}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport style={{ position: 'fixed', inset: '0', pointerEvents: 'none' }}>
              <Drawer.Popup
                data-testid="popup"
                style={{
                  position: 'absolute',
                  left: '0',
                  right: '0',
                  bottom: '0',
                  height: '300px',
                  pointerEvents: 'auto',
                  transform:
                    'translateY(calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y)))',
                }}
              >
                <div data-testid="drag" style={{ height: '100px' }}>
                  Drag
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </>,
    );

    const popup = screen.getByTestId('popup');
    const drag = screen.getByTestId('drag');
    const backdrop = screen.getByTestId('backdrop');

    await waitFor(() => {
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px');
    });

    // The old code refused swipes away from the page scroll edge, so being at the top
    // with a scrollable body is the precondition that made the up-swipe fail.
    expect(body.scrollTop).toBe(0);
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

    const rect = drag.getBoundingClientRect();
    const clientX = rect.left + 20;
    const clientY = rect.top + 80;

    await fireTouch.start(drag, { touches: [{ clientX, clientY }] });
    await fireTouch.move(drag, { touches: [{ clientX, clientY: clientY - 30 }] });

    await waitFor(() => {
      expect(backdrop).toHaveAttribute('data-swiping', '');
    });

    await fireTouch.end(drag, { changedTouches: [{ clientX, clientY: clientY - 30 }] });
  });

  it('prevents touchmove when there is no scroll container', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    stubElementFromPoint(document, () => popup);

    await fireTouch.start(popup, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchMove = createNativeTouchMove(popup, { clientX: 0, clientY: 10 });
    popup.dispatchEvent(touchMove);
    await flushMicrotasks();

    expect(touchMove.defaultPrevented).toBe(true);
    expect(backdrop).toHaveAttribute('data-swiping');
  });

  it('does not block touchmove on native range inputs', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <input type="range" data-testid="range" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const range = screen.getByTestId('range');
    const backdrop = screen.getByTestId('backdrop');

    await fireTouch.start(range, { touches: [{ clientX: 0, clientY: 0 }] });
    const dispatched = await fireTouch.move(range, { touches: [{ clientX: 20, clientY: 0 }] });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not block touchmove on slider thumb range inputs', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const sliderInput = screen.getByRole('slider');
    const backdrop = screen.getByTestId('backdrop');

    await fireTouch.start(sliderInput, { touches: [{ clientX: 0, clientY: 0 }] });
    const dispatched = await fireTouch.move(sliderInput, {
      touches: [{ clientX: 20, clientY: 0 }],
    });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting input selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <input data-testid="input" value="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const input = screen.getByTestId('input') as HTMLInputElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    input.focus();
    input.setSelectionRange(0, 5);
    stubElementFromPoint(document, () => popup);

    await fireTouch.start(popup, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const dispatched = await fireTouch.move(popup, { touches: [{ clientX: 0, clientY: 10 }] });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting textarea selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <textarea data-testid="textarea" value="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    textarea.focus();
    textarea.setSelectionRange(0, 5);
    stubElementFromPoint(document, () => popup);

    await fireTouch.start(popup, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const dispatched = await fireTouch.move(popup, { touches: [{ clientX: 0, clientY: 10 }] });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting contenteditable selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div contenteditable="true" data-testid="editable">
                Selectable text
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const editable = screen.getByTestId('editable');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(editable.firstChild).toBeTruthy();
    if (!selection || !editable.firstChild) {
      return;
    }
    onTestFinished(() => selection.removeAllRanges());

    editable.focus();
    const range = document.createRange();
    range.setStart(editable.firstChild, 0);
    range.setEnd(editable.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    stubElementFromPoint(document, () => popup);

    await fireTouch.start(popup, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const dispatched = await fireTouch.move(popup, { touches: [{ clientX: 0, clientY: 10 }] });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting regular text selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <span data-testid="text">Selectable text</span>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(text.firstChild).toBeTruthy();
    if (!selection || !text.firstChild) {
      return;
    }
    onTestFinished(() => selection.removeAllRanges());

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    stubElementFromPoint(document, () => popup);

    await fireTouch.start(popup, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const dispatched = await fireTouch.move(popup, { touches: [{ clientX: 0, clientY: 10 }] });
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('allows touchmove when scrolling down from scroll top', async () => {
    const handleTouchMove = vi.fn();

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchmove={handleTouchMove}
                style={{ overflowY: 'auto', maxHeight: '40px' }}
              >
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    await fireTouch.start(scroll, { touches: [{ clientX: 0, clientY: 0 }] });
    const prevented = await fireTouch.move(scroll, { touches: [{ clientX: 0, clientY: -10 }] });

    expect(prevented).toBe(true);
    expect(handleTouchMove).toHaveBeenCalledTimes(1);
  });

  it('does not start an opposite-direction swipe from scroll bottom for down drawers with snap points', async () => {
    await render(
      <Drawer.Root open swipeDirection="down" snapPoints={['100px', 1]}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 80;

    await fireTouch.start(scroll, { touches: [{ clientX: 0, clientY: 40 }] });
    const moveAllowed = await fireTouch.move(scroll, { touches: [{ clientX: 0, clientY: 20 }] });
    await flushMicrotasks();

    expect(moveAllowed).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  describe('swipe', () => {
    it('closes the drawer with the reason swipe after a pointer swipe past half the popup', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Drawer.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const popup = screen.getByTestId('popup');
      const { left, top } = popup.getBoundingClientRect();
      const pointer = { pointerType: 'mouse', pointerId: 1, clientX: left + 10 };
      // The swipe starts at the first move, so the release is 55 px from it: more than half the
      // popup.
      await firePointer.down(popup, {
        ...pointer,
        button: 0,
        buttons: 1,
        clientY: top + 30,
        timeStamp: 1,
      });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 40, timeStamp: 101 });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 95, timeStamp: 201 });
      await firePointer.up(popup, {
        ...pointer,
        button: 0,
        buttons: 0,
        clientY: top + 95,
        timeStamp: 301,
      });

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      const [open, details] = handleOpenChange.mock.calls[0];
      expect(open).toBe(false);
      expect(details.reason).toBe(REASONS.swipe);
      expect(popup).toHaveAttribute('data-swipe-dismiss', '');
    });

    it('VUE-58: lets a pointer listener of the consumer stop the swipe of the viewport', async () => {
      let stopSwipe = true;
      const handlePointerDown = vi.fn((event: VaseUIEvent<PointerEvent>) => {
        if (stopSwipe) {
          event.preventVaseUIHandler();
        }
      });
      await render(
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport onPointerdown={handlePointerDown}>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const popup = screen.getByTestId('popup');
      const { left, top } = popup.getBoundingClientRect();
      const pointer = { pointerType: 'mouse', pointerId: 1, clientX: left + 10 };
      let timeStamp = 1;
      function nextEvent(buttons: number, offset: number) {
        timeStamp += 16;
        return { ...pointer, buttons, clientY: top + offset, timeStamp };
      }
      async function drag() {
        await firePointer.down(popup, { ...nextEvent(1, 10), button: 0 });
        await firePointer.move(popup, nextEvent(1, 20));
        await firePointer.move(popup, nextEvent(1, 30));
      }

      await drag();
      expect(handlePointerDown).toHaveBeenCalledTimes(1);
      expect(popup).not.toHaveAttribute('data-swiping');
      await firePointer.up(popup, { ...nextEvent(0, 30), button: 0 });

      stopSwipe = false;
      await drag();
      expect(handlePointerDown).toHaveBeenCalledTimes(2);
      expect(popup).toHaveAttribute('data-swiping', '');
      await firePointer.up(popup, { ...nextEvent(0, 30), button: 0 });
    });

    it('gives the viewport no nested dialog attribute while a nested drawer is open', async () => {
      await render(
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="parent-viewport">
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open modal={false}>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup>Child drawer</Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-popup')).toHaveAttribute('data-nested-drawer-open', '');
      });
      expect(screen.getByTestId('parent-viewport')).not.toHaveAttribute('data-nested-dialog-open');
    });
  });

  describe('KeepAlive', () => {
    it('VUE-5: removes the document touchmove listener while KeepAlive holds the drawer, and adds it again at the activation', async () => {
      const activeListeners = trackTouchMoveListeners();
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => (
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>Drawer</Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });

      await render(() => (
        <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
      ));
      await flushMicrotasks();
      expect(activeListeners.size).toBe(1);

      shown.value = false;
      await flushMicrotasks();
      expect(activeListeners.size).toBe(0);

      shown.value = true;
      await flushMicrotasks();
      expect(activeListeners.size).toBe(1);
    });
  });
});
