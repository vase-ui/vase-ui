import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import * as Drawer from '../index.parts';
import { useDrawerVirtualKeyboardContext } from './DrawerVirtualKeyboardContext';

const platformMock = vi.hoisted(() => ({ android: false }));

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: {
        ...actual.platform.os,
        get android() {
          return platformMock.android;
        },
      },
    },
  };
});

type TouchPoint = { clientX: number; clientY: number };

// Firefox and WebKit on a desktop cannot construct a `Touch`, so the lists hold the points.
function createNativeTouchEvent(type: 'touchend' | 'touchcancel', point: TouchPoint) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: [point], configurable: true },
    touches: { value: [], configurable: true },
  });
  return event;
}

async function dispatchTouchEnd(target: Element, point: TouchPoint) {
  const touchEnd = createNativeTouchEvent('touchend', point);
  target.dispatchEvent(touchEnd);
  await flushMicrotasks();
  return touchEnd;
}

async function dispatchTouchCancel(target: Element, point: TouchPoint) {
  target.dispatchEvent(createNativeTouchEvent('touchcancel', point));
  await flushMicrotasks();
}

function stubElementFromPoint(root: Document | ShadowRoot, getElement: () => Element | null) {
  const originalElementFromPoint = root.elementFromPoint;
  root.elementFromPoint = getElement;
  onTestFinished(() => {
    root.elementFromPoint = originalElementFromPoint;
  });
}

function mockVisualViewport(height: number) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const listeners = new Map<string, Set<EventListener>>();

  const visualViewport: Pick<VisualViewport, 'addEventListener' | 'removeEventListener'> & {
    height: number;
    scale: number;
    offsetTop: number;
  } = {
    height,
    offsetTop: 0,
    scale: 1,
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }

      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
  };

  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport as VisualViewport,
  });
  onTestFinished(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'visualViewport', originalDescriptor);
    } else {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    }
  });

  function emit(type: string) {
    listeners.get(type)?.forEach((listener) => listener(new Event(type)));
  }

  return {
    listeners,
    resize(nextHeight: number) {
      visualViewport.height = nextHeight;
      emit('resize');
    },
    setScale(nextScale: number) {
      visualViewport.scale = nextScale;
      emit('resize');
    },
    scroll(nextOffsetTop: number, nextHeight?: number) {
      visualViewport.offsetTop = nextOffsetTop;
      if (nextHeight !== undefined) {
        visualViewport.height = nextHeight;
      }
      emit('scroll');
    },
  };
}

function mockResizableInnerHeight(initialHeight: number) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  let innerHeight = initialHeight;

  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => innerHeight,
  });
  onTestFinished(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'innerHeight', originalDescriptor);
    }
  });

  return {
    resize(nextHeight: number) {
      innerHeight = nextHeight;
      window.dispatchEvent(new Event('resize'));
    },
  };
}

function mockWindowInnerHeight(innerHeight: number) {
  mockResizableInnerHeight(innerHeight);
}

function setScrollSize(element: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

// Applies the scroll of the provider at once, so that an assertion does not wait on a smooth scroll.
function scrollInstantly(element: HTMLElement) {
  element.scrollTo = ((options?: ScrollToOptions | number) => {
    if (typeof options === 'object' && options !== null && options.top !== undefined) {
      element.scrollTop = options.top;
    }
  }) as typeof element.scrollTo;
}

function setFieldTop(field: HTMLElement, scroll: HTMLElement, top: number) {
  field.getBoundingClientRect = () => new DOMRect(0, top - scroll.scrollTop, 320, 40);
}

async function flushAnimationFrames(count: number) {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

const DirectVirtualKeyboardTouchTarget = defineComponent({
  name: 'DirectVirtualKeyboardTouchTarget',
  setup() {
    const virtualKeyboard = useDrawerVirtualKeyboardContext();

    return () => (
      <input
        data-testid="input"
        type="text"
        onTouchstart={virtualKeyboard?.onTouchStart}
        onTouchend={virtualKeyboard?.onTouchEnd}
      />
    );
  },
});

const KeyboardDrawer = defineComponent({
  name: 'KeyboardDrawer',
  props: {
    open: { type: Boolean, default: true },
    modal: { type: [Boolean, String] as PropType<boolean | 'trap-focus'>, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <Drawer.Root open={props.open} modal={props.modal}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">{slots.default?.()}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    );
  },
});

describe('<Drawer.VirtualKeyboardProvider />', () => {
  const { render } = createRenderer();

  it('compensates for keyboard overlap without adding extra spacing and centers the focused input', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <Drawer.Content
          data-testid="scroll"
          style={{
            height: '420px',
            overflowY: 'auto',
            overflowAnchor: 'auto',
            paddingBottom: '20px',
          }}
        >
          <div style={{ height: '900px' }} />
          <input data-testid="input" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    setFieldTop(input, scroll, 650);
    scrollInstantly(scroll);

    const keyboardViewportHeight = 500;
    input.focus();
    scroll.scrollTop = 0;
    visualViewport.resize(keyboardViewportHeight);
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('240px');
    });
    await waitFor(() => {
      expect(scroll.style.scrollPaddingBottom).not.toBe('');
    });
    await waitFor(() => {
      expect(scroll.style.overflowAnchor).toBe('none');
    });
    await waitFor(() => {
      const scrollRect = scroll.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const inputCenter = (inputRect.top + inputRect.bottom) / 2;
      const visibleCenter = (scrollRect.top + keyboardViewportHeight) / 2;
      expect(inputCenter).toBeCloseTo(visibleCenter, 0);
    });

    input.blur();
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('20px');
    });
    await waitFor(() => {
      expect(scroll.style.scrollPaddingBottom).toBe('');
    });
    await waitFor(() => {
      expect(scroll.style.overflowAnchor).toBe('auto');
    });
  });

  it('tops the scroll container padding up to the visibility margin below the overlap', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <Drawer.Content
          data-testid="scroll"
          style={{ height: '420px', overflowY: 'auto', paddingBottom: '0px' }}
        >
          <div style={{ height: '900px' }} />
          <input data-testid="input" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    // 220px of overlap plus the 16px margin the container's own padding does not cover.
    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('236px');
    });

    input.blur();
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('0px');
    });
  });

  it('adds scroll slack to a light-DOM scroller for an input inside a shadow root', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <Drawer.Content
          data-testid="scroll"
          style={{
            height: '420px',
            overflowY: 'auto',
            overflowAnchor: 'auto',
            paddingBottom: '20px',
          }}
        >
          <div style={{ height: '900px' }} />
          <div data-testid="host" />
        </Drawer.Content>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const host = screen.getByTestId('host');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    shadowRoot.append(input);

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    setFieldTop(input, scroll, 650);
    scrollInstantly(scroll);

    const keyboardViewportHeight = 500;
    input.focus();
    scroll.scrollTop = 0;
    visualViewport.resize(keyboardViewportHeight);
    await flushMicrotasks();

    // Slack reaches the light-DOM scroller even though the input lives in a shadow root.
    await waitFor(() => {
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(20);
    });
    await waitFor(() => {
      expect(scroll.style.overflowAnchor).toBe('none');
    });
    await waitFor(() => {
      const scrollRect = scroll.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const inputCenter = (inputRect.top + inputRect.bottom) / 2;
      const visibleCenter = (scrollRect.top + keyboardViewportHeight) / 2;
      expect(inputCenter).toBeCloseTo(visibleCenter, 0);
    });
  });

  it('adds keyboard scroll slack to a potential scroll ancestor for textareas', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div
          data-testid="scroll"
          style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
        >
          <div style={{ height: '300px' }} />
          <textarea data-testid="textarea" />
        </div>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const textarea = screen.getByTestId('textarea');

    setScrollSize(scroll, 420, 420);
    setScrollSize(textarea, 88, 88);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    textarea.getBoundingClientRect = () => new DOMRect(0, 650, 320, 40);

    textarea.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(20);
    });
    await waitFor(() => {
      expect(textarea.style.paddingBottom).toBe('');
    });
  });

  it('adds keyboard scroll slack to the scroll container, not an overflowing textarea', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div
          data-testid="scroll"
          style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
        >
          <div style={{ height: '300px' }} />
          <textarea data-testid="textarea" value={'line\n'.repeat(40)} />
        </div>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const textarea = screen.getByTestId('textarea');

    setScrollSize(scroll, 420, 800);
    // The textarea's own content overflows, making it scrollable itself. Scrolling
    // it cannot move its box above the keyboard, so slack must go to the ancestor.
    setScrollSize(textarea, 88, 600);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    textarea.getBoundingClientRect = () => new DOMRect(0, 650, 320, 40);

    textarea.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(20);
    });
    expect(textarea.style.paddingBottom).toBe('');
  });

  it('sets the keyboard inset CSS variable for a focused input without a scroll target', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div>
          <input data-testid="input" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const input = screen.getByTestId('input');

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });
    await waitFor(() => {
      expect(getComputedStyle(popup).getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });

    input.blur();
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    });
  });

  it('captures focusin targets through a shadow root', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div data-testid="host" />
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const host = screen.getByTestId('host');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    shadowRoot.append(input);

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });
  });

  it('keeps the keyboard inset when focus moves directly to another keyboard input', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div>
          <input data-testid="input-a" type="text" />
          <input data-testid="input-b" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const inputA = screen.getByTestId('input-a');
    const inputB = screen.getByTestId('input-b');

    inputA.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });

    // Focus moving straight to another keyboard input must re-align to the new
    // target, not clear the inset — otherwise it flickers to 0px between fields.
    // Dispatch the focusout in isolation (no following focusin) so a regression
    // that cleared on every focusout would leave nothing to restore the inset.
    inputA.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inputB }));
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });
  });

  it('does not add keyboard scroll slack by default', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content
                data-testid="scroll"
                style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
              >
                <div style={{ height: '900px' }} />
                <input data-testid="input" type="text" />
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    input.focus();
    scroll.scrollTop = 0;
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('20px');
    });
    await waitFor(() => {
      expect(scroll.style.scrollPaddingBottom).toBe('');
    });
    await waitFor(() => {
      expect(scroll.scrollTop).toBe(0);
    });
  });

  it('restores keyboard scroll slack when the drawer closes', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const open = shallowRef(true);

    await render(() => (
      <KeyboardDrawer open={open.value}>
        <Drawer.Content
          data-testid="scroll"
          style={{
            height: '420px',
            overflowY: 'auto',
            overflowAnchor: 'auto',
            paddingBottom: '20px',
          }}
        >
          <div style={{ height: '900px' }} />
          <input data-testid="input" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>
    ));

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    input.getBoundingClientRect = () => new DOMRect(0, 650, 320, 40);

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(20);
    });
    await waitFor(() => {
      expect(scroll.style.overflowAnchor).toBe('none');
    });

    open.value = false;
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('20px');
    });
    await waitFor(() => {
      expect(scroll.style.scrollPaddingBottom).toBe('');
    });
    await waitFor(() => {
      expect(scroll.style.overflowAnchor).toBe('auto');
    });
  });

  it.each([false, true])(
    'releases keyboard inset and scroll slack after focus leaves the field (pointerdown: %s)',
    async (pointerDown) => {
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);

      await render(
        <KeyboardDrawer>
          <Drawer.Content
            data-testid="scroll"
            style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
          >
            <input data-testid="input" type="text" />
            <div style={{ height: '900px' }} />
            <button data-testid="item" type="button" />
          </Drawer.Content>
        </KeyboardDrawer>,
      );

      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');
      const item = screen.getByTestId('item');

      scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);

      input.focus();
      visualViewport.resize(500);
      await flushMicrotasks();

      await waitFor(() => {
        expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(20);
      });

      // Scroll into the slack, where removing it would clamp the scroll position.
      scroll.scrollTop = scroll.scrollHeight;
      const scrollTop = scroll.scrollTop;
      const paddingBottom = scroll.style.paddingBottom;
      const inset = viewport.style.getPropertyValue('--drawer-keyboard-inset');

      // A tap's `mousedown` moves focus, and its `mouseup` and `click` are hit-tested at the
      // same point in the same task, so nothing under the finger may move synchronously.
      let pointerDownDispatch: Promise<boolean> | undefined;
      if (pointerDown) {
        // A consumer can move focus before pointerdown reaches the provider.
        window.addEventListener('pointerdown', () => item.focus(), { capture: true, once: true });
        pointerDownDispatch = firePointer.down(item, { timeStamp: 1 });
      } else {
        item.focus();
      }

      expect(scroll.style.paddingBottom).toBe(paddingBottom);
      expect(scroll.scrollTop).toBe(scrollTop);
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe(inset);

      await pointerDownDispatch;
      await flushAnimationFrames(1);
      await flushMicrotasks();

      expect(scroll.style.paddingBottom).toBe('20px');
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    },
  );

  it('activates an item on the first tap while the keyboard is open', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const onClick = vi.fn();

    await render(
      <Drawer.Root open modal={false}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup
                style={{
                  position: 'fixed',
                  left: '0px',
                  top: 'calc(360px - var(--drawer-keyboard-inset, 0px))',
                }}
              >
                <input data-testid="input" type="text" />
                <button
                  data-testid="item"
                  type="button"
                  onClick={onClick}
                  style={{ display: 'block', width: '200px', height: '40px' }}
                >
                  Select item
                </button>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    screen.getByTestId('input').focus();
    visualViewport.resize(500);
    await flushMicrotasks();
    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    });

    const item = screen.getByTestId('item');
    const itemRect = item.getBoundingClientRect();
    const x = itemRect.left + itemRect.width / 2;
    const y = itemRect.top + itemRect.height / 2;

    // A tap's compatibility mousedown moves focus, then mouseup and click are hit-tested at
    // the tap point in the same task. A synchronous inset reset on focus loss would move
    // the item away before they land.
    const mouseDown = fireEvent.mouseDown(item);
    item.focus();
    const target = document.elementFromPoint(x, y)!;
    const mouseUp = fireEvent.mouseUp(target);
    const click = fireEvent.click(target);
    await Promise.all([mouseDown, mouseUp, click]);

    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    });
  });

  it('does not add keyboard scroll slack while pinch-zoomed', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <Drawer.Content
          data-testid="scroll"
          style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
        >
          <div style={{ height: '900px' }} />
          <input data-testid="input" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    input.focus();
    scroll.scrollTop = 0;
    visualViewport.setScale(1.5);
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(scroll.style.paddingBottom).toBe('20px');
    });
    await waitFor(() => {
      expect(scroll.style.scrollPaddingBottom).toBe('');
    });
    await waitFor(() => {
      expect(scroll.scrollTop).toBe(0);
    });
  });

  it('focuses an unfocused keyboard input on touchend without page scroll', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <input
                  data-testid="input"
                  style={{ opacity: 0.5, transform: 'scale(1)', transition: 'opacity 1s' }}
                  type="text"
                />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );

    const backdrop = screen.getByTestId('backdrop');
    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const clickEvents: MouseEvent[] = [];
    input.addEventListener('click', (clickEvent) => {
      clickEvents.push(clickEvent);
    });
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 12, clientY: 34 }] });

    await waitFor(() => {
      expect(backdrop).toHaveAttribute('data-swiping', '');
    });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 12, clientY: 34 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    // Preventing the touchend default suppresses the native compatibility
    // click, so the provider redispatches it.
    expect(clickEvents).toHaveLength(1);
    expect(clickEvents[0].clientX).toBe(12);
    expect(clickEvents[0].clientY).toBe(34);
    expect(clickEvents[0].detail).toBe(1);
    expect(input.style.opacity).toBe('0.5');
    expect(input.style.transform).toBe('scale(1)');
    expect(input.style.transition).toBe('opacity 1s');

    await waitFor(() => {
      expect(backdrop).not.toHaveAttribute('data-swiping');
    });
  });

  it('preserves native taps on picker inputs', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="date" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
