import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
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

// The provider reads only `clientX` and `clientY` of a touch, and WebKit on a desktop cannot
// construct a `Touch`. The lists thus hold the points.
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

function stubElementFromPoint(
  root: Document | ShadowRoot,
  getElement: (x: number, y: number) => Element | null,
) {
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

function restoreWindowScrollYAfterTest() {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
  onTestFinished(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'scrollY', originalDescriptor);
    }
  });
}

function setScrollSize(element: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

// Applies the scroll of the provider at once, so that an assertion does not wait on a smooth scroll.
// A case that reads the scroll position focuses its fields with `preventScroll`. Chromium reveals a
// field in `focus()`, but Firefox and WebKit can reveal it after the case sets the position.
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

// React focuses an `autoFocus` element at the mount. A browser focuses only the first
// `autofocus` element of a document.
function focusElement(element: unknown) {
  if (element instanceof HTMLElement) {
    element.focus();
  }
}

async function flushAnimationFrames(count: number) {
  for (let i = 0; i < count; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

function setAndroid(android: boolean) {
  platformMock.android = android;
  onTestFinished(() => {
    platformMock.android = false;
  });
}

function useFakeTimers() {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

const DirectVirtualKeyboardTouchTarget = defineComponent({
  name: 'DirectVirtualKeyboardTouchTarget',
  setup() {
    const virtualKeyboard = useDrawerVirtualKeyboardContext();

    return () => (
      <input
        data-testid="input"
        type="text"
        onTouchstart={virtualKeyboard?.onTouchstart}
        onTouchend={virtualKeyboard?.onTouchend}
      />
    );
  },
});

const KeyboardDrawer = defineComponent({
  name: 'KeyboardDrawer',
  props: {
    open: { type: Boolean, default: true },
    modal: { type: [Boolean, String] as PropType<boolean | 'trap-focus'>, default: false },
    initialFocus: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <Drawer.Root open={props.open} modal={props.modal}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup" initialFocus={props.initialFocus}>
                {slots.default?.()}
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    );
  },
});

const ScrollBodyDrawer = defineComponent({
  name: 'ScrollBodyDrawer',
  setup() {
    return () => (
      <KeyboardDrawer>
        <Drawer.Content
          data-testid="scroll"
          style={{ height: '420px', overflowY: 'auto', paddingBottom: '20px' }}
        >
          <input data-testid="first" type="text" />
          <div style={{ height: '900px' }} />
          <input data-testid="second" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>
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
    input.focus({ preventScroll: true });
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
    input.focus({ preventScroll: true });
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

    input.focus({ preventScroll: true });
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

    input.focus({ preventScroll: true });
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

  it('preserves native taps that lift over a neighboring interactive element', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
        <button data-testid="button" type="button">
          Action
        </button>
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const button = screen.getByTestId('button');
    const focusSpy = vi.spyOn(input, 'focus');
    const inputClickEvents: MouseEvent[] = [];
    input.addEventListener('click', (clickEvent) => {
      inputClickEvents.push(clickEvent);
    });
    // The finger lifts over the button, but `touchend.target` stays on the
    // touchstart input on mobile, so the lift point must win over the fallback.
    stubElementFromPoint(document, () => button);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    // The native touchend is still dispatched on the touchstart input.
    const touchEnd = await dispatchTouchEnd(input, { clientX: 5, clientY: 5 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(inputClickEvents).toHaveLength(0);
  });

  it('resolves the lift point through the shadow root when the drawer renders in one', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => {
      host.remove();
    });
    const shadowRoot = host.attachShadow({ mode: 'open' });

    await render(
      <Drawer.Root open modal={false}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal container={shadowRoot}>
            <Drawer.Viewport>
              <Drawer.Popup>
                <input data-testid="input" type="text" />
                <button data-testid="button" type="button">
                  Action
                </button>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );
    await flushMicrotasks();

    const input = shadowRoot.querySelector<HTMLInputElement>('[data-testid="input"]');
    const button = shadowRoot.querySelector<HTMLButtonElement>('[data-testid="button"]');
    expect(input).not.toBeNull();
    expect(button).not.toBeNull();
    if (!input || !button) {
      return;
    }

    const focusSpy = vi.spyOn(input, 'focus');
    // A real document hit test retargets shadow content to the host, so only the shadow
    // root sees the button under the lift point. Resolving against the document would miss
    // it and fall back to focusing the touchstart input.
    stubElementFromPoint(document, () => host);
    stubElementFromPoint(shadowRoot, () => button);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 5, clientY: 5 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('preserves native taps on disabled inputs', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" disabled />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const clickEvents: MouseEvent[] = [];
    input.addEventListener('click', (clickEvent) => {
      clickEvents.push(clickEvent);
    });
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(clickEvents).toHaveLength(0);
  });

  it('preserves native taps on disabled textareas', async () => {
    await render(
      <KeyboardDrawer>
        <textarea data-testid="input" disabled />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const clickEvents: MouseEvent[] = [];
    input.addEventListener('click', (clickEvent) => {
      clickEvents.push(clickEvent);
    });
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(clickEvents).toHaveLength(0);
  });

  it('preserves native taps on a disabled labelled control', async () => {
    await render(
      <KeyboardDrawer>
        <label data-testid="label" for="note">
          Note
        </label>
        <input data-testid="input" id="note" type="text" disabled />
      </KeyboardDrawer>,
    );

    const label = screen.getByTestId('label');
    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const labelClickEvents: MouseEvent[] = [];
    label.addEventListener('click', (clickEvent) => {
      labelClickEvents.push(clickEvent);
    });
    stubElementFromPoint(document, () => label);

    await fireTouch.start(label, { touches: [{ clientX: 24, clientY: 48 }] });

    const touchEnd = await dispatchTouchEnd(label, { clientX: 24, clientY: 48 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(labelClickEvents).toHaveLength(0);
  });

  it('focuses a keyboard input with data-base-ui-swipe-ignore without starting drawer swipe', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <input data-testid="input" data-vase-ui-swipe-ignore type="text" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );

    const backdrop = screen.getByTestId('backdrop');
    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not focus a keyboard input on touchend without touchstart', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('does not focus a keyboard input after touchcancel', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    await dispatchTouchCancel(input, { clientX: 0, clientY: 0 });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('does not focus a keyboard input while a nested drawer is open', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <input data-testid="input" type="text" />
                <Drawer.Root open modal={false}>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup>
                        <button type="button">Nested action</button>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );

    const input = screen.getByTestId('input');
    const parentPopup = screen.getByTestId('parent-popup');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    });

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('preserves native taps on an already-focused keyboard input', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(500);

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');

    input.focus();
    await flushMicrotasks();

    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('refocuses an already-focused keyboard input when the keyboard viewport is closed', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');

    input.focus();
    await flushMicrotasks();

    const focusSpy = vi.spyOn(input, 'focus');
    const blurSpy = vi.spyOn(input, 'blur');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(blurSpy).toHaveBeenCalledTimes(1);
    // iOS 27 only re-presents a natively dismissed keyboard for a refocus of the
    // already-focused input, so the blur/focus transition is followed by one.
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(input).toHaveFocus();
  });

  it('preserves native taps on an already-focused keyboard input on Android when no keyboard is detected', async () => {
    // A keyboard that resizes the layout viewport (`interactive-widget=resizes-content`)
    // shrinks `innerHeight` with the visual viewport, so it is never detected.
    setAndroid(true);
    mockWindowInnerHeight(500);
    mockVisualViewport(500);

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');

    input.focus();
    await flushMicrotasks();

    const focusSpy = vi.spyOn(input, 'focus');
    const blurSpy = vi.spyOn(input, 'blur');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(blurSpy).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('refocuses a tapped input after focus moves from another input while the keyboard is closed', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="first" type="text" />
        <input data-testid="second" type="text" />
      </KeyboardDrawer>,
    );

    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    // The keyboard was dismissed natively, leaving the first field focused.
    first.focus();
    await flushMicrotasks();

    const focusSpy = vi.spyOn(second, 'focus');
    const onFocus = vi.fn();
    second.addEventListener('focus', onFocus);
    const focusedDuringCall: boolean[] = [];
    focusSpy.mockImplementation(function focus(this: HTMLElement, options?: FocusOptions) {
      focusedDuringCall.push(document.activeElement === second);
      HTMLElement.prototype.focus.call(this, options);
    });
    stubElementFromPoint(document, () => second);

    await fireTouch.start(second, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(second, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(focusedDuringCall).toEqual([false, true]);
    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(second).toHaveFocus();
  });

  it('overrides the incoming field geometry when focus moves without a tap while the keyboard is open', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="first" type="text" />
        <input data-testid="second" type="text" />
      </KeyboardDrawer>,
    );

    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    first.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    // The provider's capture-phase focusout listener runs before this bubble-phase one,
    // so the geometry override must already be applied when it fires.
    let transformDuringFocusChange: string | null = null;
    const onFocusOut = () => {
      transformDuringFocusChange = second.style.transform;
    };
    document.addEventListener('focusout', onFocusOut);
    onTestFinished(() => {
      document.removeEventListener('focusout', onFocusOut);
    });
    const blurSpy = vi.spyOn(second, 'blur');
    const focusSpy = vi.spyOn(second, 'focus');
    const onFocus = vi.fn();
    second.addEventListener('focus', onFocus);
    let optionsDuringFocusIn: FocusOptions | undefined;
    second.addEventListener('focusin', () => {
      optionsDuringFocusIn = focusSpy.mock.lastCall?.[0];
    });

    // Simulates the iOS keyboard's next-field arrow: focus moves with no touch events.
    second.focus();
    await flushMicrotasks();

    expect(transformDuringFocusChange).toContain('translateY');
    expect(second.style.transform).toBe('');
    expect(second.style.opacity).toBe('');
    expect(blurSpy).not.toHaveBeenCalled();
    // The iOS 27 native focus request is recorded between focus and focusin.
    // Protect it during focus without emitting another focus/blur cycle.
    expect(optionsDuringFocusIn).toEqual({ preventScroll: true });
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(second).toHaveFocus();
  });

  it('centers a field focused without a tap inside the scrollable body', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(<ScrollBodyDrawer />);

    const scroll = screen.getByTestId('scroll');
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    // `first` sits at the center of the visible band above the keyboard, so the
    // initial alignment leaves the scroll position at 0.
    setFieldTop(first, scroll, 380);
    setFieldTop(second, scroll, 650);
    scrollInstantly(scroll);

    const keyboardViewportHeight = 500;
    first.focus({ preventScroll: true });
    scroll.scrollTop = 0;
    visualViewport.resize(keyboardViewportHeight);
    await flushMicrotasks();

    // Simulates the iOS keyboard's next-field arrow: focus moves with no touch events.
    second.focus({ preventScroll: true });
    await flushMicrotasks();

    await waitFor(() => {
      const scrollRect = scroll.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      const secondCenter = (secondRect.top + secondRect.bottom) / 2;
      const visibleCenter = (scrollRect.top + keyboardViewportHeight) / 2;
      expect(secondCenter).toBeCloseTo(visibleCenter, 0);
    });
  });

  it('does not restart a progressing or settled reduced-motion alignment scroll', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
        }) as MediaQueryList,
    );
    onTestFinished(() => {
      matchMediaSpy.mockRestore();
    });
    useFakeTimers();

    await render(<ScrollBodyDrawer />);

    const scroll = screen.getByTestId('scroll');
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    setFieldTop(first, scroll, 380);
    setFieldTop(second, scroll, 650);
    const scrollToSpy = vi.fn();
    scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

    first.focus({ preventScroll: true });
    visualViewport.resize(500);
    await flushMicrotasks();

    scrollToSpy.mockClear();

    second.focus({ preventScroll: true });
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    await flushMicrotasks();

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 270, behavior: 'auto' });

    scroll.scrollTop = 100;
    await vi.advanceTimersByTimeAsync(150);
    await flushMicrotasks();
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    scroll.scrollTop = 270;
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    expect(scroll.scrollTop).toBe(270);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('re-issues the alignment scroll when a delayed realign pass finds it stalled', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(<ScrollBodyDrawer />);

    const scroll = screen.getByTestId('scroll');
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    setFieldTop(first, scroll, 380);
    setFieldTop(second, scroll, 650);
    // The mock never moves, standing in for a smooth scroll canceled by WebKit's
    // native reveal resolution: a later realign pass must re-issue it.
    const scrollToSpy = vi.fn();
    scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

    first.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    scrollToSpy.mockClear();

    second.focus();
    await flushMicrotasks();

    await waitFor(() => {
      expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(scrollToSpy).toHaveBeenLastCalledWith(expect.objectContaining({ top: 270 }));
  });

  it('stops pending realignment once the user starts scrolling while geometry is changing', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    useFakeTimers();

    await render(<ScrollBodyDrawer />);

    const scroll = screen.getByTestId('scroll');
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    setScrollSize(scroll, 420, 1200);
    let scrollBottom = 380;
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, scrollBottom - 300);
    setFieldTop(first, scroll, 380);
    setFieldTop(second, scroll, 650);
    // The mock never moves, standing in for a smooth scroll canceled by WebKit's native
    // reveal resolution — the exact stall a delayed pass would re-issue. A user scroll
    // stops at a stationary position the same way, so a pointer going down must cancel the
    // passes rather than let one mistake the manual scroll for a canceled reveal and yank
    // the drawer back to center.
    const scrollToSpy = vi.fn();
    scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

    first.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    scrollToSpy.mockClear();

    second.focus();
    // Let the first settle check observe the squeezed body before the user takes over.
    vi.advanceTimersToNextFrame();
    scroll.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    // The body continues expanding after pointer-down, then the destination settles.
    // A live frame loop would eventually center the field against the final geometry.
    for (const bottom of [400, 440, 480, 480]) {
      scrollBottom = bottom;
      vi.advanceTimersToNextFrame();
    }

    await vi.runAllTimersAsync();
    await flushMicrotasks();

    // Pointer-down cancels both the pending frame alignment and delayed passes.
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('clears keyboard state when a tapped input redirects focus away', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(500);
    useFakeTimers();

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
        <button data-testid="other" type="button" />
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const input = screen.getByTestId('input');
    const other = screen.getByTestId('other');

    // A consumer redirects focus off the field the moment it focuses (validation,
    // auto-advance, composite focus). Listening on `focusin` at the target matches React's
    // `onFocus`: it runs after the provider's capture-phase `focusin` has already recorded
    // the input, so the provider must reconcile when focus lands on a non-keyboard element.
    input.addEventListener('focusin', () => {
      other.focus();
    });

    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 12, clientY: 34 }] });

    await dispatchTouchEnd(input, { clientX: 12, clientY: 34 });
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    // Focus stays on the redirected element and the drawer left no keyboard inset
    // behind for the abandoned input.
    expect(other).toHaveFocus();
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
  });

  it('clears keyboard state when a tapped input blurs itself', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(500);

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

    const viewport = screen.getByTestId('viewport');
    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
    input.getBoundingClientRect = () => new DOMRect(0, 650, 320, 40);

    // A consumer that opens its own picker instead of the software keyboard blurs the field
    // from `onFocus`. The `focusout` arrives before `.focus()` returns, and focus ends on the
    // body, so no `focusin` follows to reconcile from: that `focusout` is the provider's only
    // chance to drop the field. Focus does eventually return to the popup, but only on a
    // later task, so a retained target keeps aligning against the blurred field until then.
    input.addEventListener('focusin', () => {
      input.blur();
    });

    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 12, clientY: 34 }] });

    input.dispatchEvent(createNativeTouchEvent('touchend', { clientX: 12, clientY: 34 }));
    // Let the frame-scheduled alignment run: it is what applies the inset and slack to a
    // target the `focusout` failed to clear.
    await flushAnimationFrames(3);
    await flushMicrotasks();

    expect(input).not.toHaveFocus();
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    expect(scroll.style.paddingBottom).toBe('20px');
    expect(scroll.style.scrollPaddingBottom).toBe('');
  });

  it('defers the alignment scroll until the destination stops moving', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    useFakeTimers();

    await render(
      <KeyboardDrawer>
        <Drawer.Content data-testid="scroll" style={{ height: '420px', overflowY: 'auto' }}>
          <div style={{ height: '900px' }} />
          <input data-testid="input" type="text" />
        </Drawer.Content>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);
    // The scroller's bottom edge moves after focus (like a footer resizing over a
    // CSS transition): squeezed at first, settled a frame later.
    let scrollBottom = 380;
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, scrollBottom - 300);
    setFieldTop(input, scroll, 650);
    const scrollToSpy = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options !== null && options.top !== undefined) {
        scroll.scrollTop = options.top;
      }
    });
    scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

    visualViewport.resize(500);
    await flushMicrotasks();

    input.focus({ preventScroll: true });
    await flushMicrotasks();

    // Let the first alignment check measure the squeezed geometry, then settle it.
    vi.advanceTimersToNextFrame();
    scrollBottom = 480;
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    // Squeezed destination: visible band [316, 364] → center 340, input center 670
    // → scrollTop 330. Settled: band [316, 464] → center 390 → scrollTop 280. The
    // squeezed destination must never be scrolled to.
    expect(scroll.scrollTop).toBe(280);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).not.toHaveBeenCalledWith(expect.objectContaining({ top: 330 }));
  });

  it('eventually aligns when geometry never settles', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(500);
    useFakeTimers();

    await render(
      <KeyboardDrawer initialFocus={false}>
        <div data-testid="scroll" style={{ height: '420px', overflowY: 'auto' }}>
          <input data-testid="input" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');
    let geometryTick = 0;
    setScrollSize(scroll, 420, 1200);
    scroll.getBoundingClientRect = () => {
      geometryTick += 1;
      return new DOMRect(0, geometryTick % 2 === 0 ? 100 : 200, 320, 300);
    };
    input.getBoundingClientRect = () => new DOMRect(0, 650, 320, 40);
    const scrollToSpy = vi.fn();
    scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

    input.focus();
    for (let index = 0; index < 65; index += 1) {
      vi.advanceTimersToNextFrame();
    }
    await flushMicrotasks();

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('realigns a tapped field in the scrollable body when the keyboard is already open for a field outside it', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <Drawer.Content data-testid="scroll" style={{ height: '420px', overflowY: 'auto' }}>
          <div style={{ height: '900px' }} />
          <textarea data-testid="textarea" />
        </Drawer.Content>
        <div>
          <input data-testid="footer-input" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const scroll = screen.getByTestId('scroll');
    const textarea = screen.getByTestId('textarea');
    const footerInput = screen.getByTestId('footer-input');

    setScrollSize(scroll, 420, 1200);
    // The scroller is squeezed while the footer field holds focus (the demo footer
    // grows by the keyboard inset via `:focus-within`); it expands back over a CSS
    // transition once focus moves into the body.
    let scrollBottom = 380;
    scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, scrollBottom - 100);
    setFieldTop(textarea, scroll, 650);
    scrollInstantly(scroll);

    const keyboardViewportHeight = 500;
    footerInput.focus();
    visualViewport.resize(keyboardViewportHeight);
    await flushMicrotasks();

    stubElementFromPoint(document, () => textarea);

    await fireTouch.start(textarea, { touches: [{ clientX: 24, clientY: 300 }] });

    await dispatchTouchEnd(textarea, { clientX: 24, clientY: 300 });

    expect(textarea).toHaveFocus();

    // The frame-scheduled pass centers against the squeezed geometry:
    // visible band [116, 364] → center 240, textarea center 670 → scrollTop 430.
    await waitFor(() => {
      expect(scroll.scrollTop).toBe(430);
    });

    // The footer's shrink transition settles; only the delayed realign passes see
    // the expanded scroller (the keyboard stays open, so no viewport events fire).
    scrollBottom = 480;

    await waitFor(() => {
      const scrollRect = scroll.getBoundingClientRect();
      const textareaRect = textarea.getBoundingClientRect();
      const textareaCenter = (textareaRect.top + textareaRect.bottom) / 2;
      const visibleCenter =
        (scrollRect.top + Math.min(scrollRect.bottom, keyboardViewportHeight)) / 2;
      expect(textareaCenter).toBeCloseTo(visibleCenter, 0);
    });
  });

  it('does not blur and re-focus for focus changes while the keyboard is closed', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="first" type="text" />
        <input data-testid="second" type="text" />
      </KeyboardDrawer>,
    );

    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');

    first.focus();
    await flushMicrotasks();

    const blurSpy = vi.spyOn(second, 'blur');
    const focusSpy = vi.spyOn(second, 'focus');

    second.focus();
    await flushMicrotasks();

    expect(blurSpy).not.toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(second).toHaveFocus();
  });

  it('restores the page scroll position when a modal drawer page scrolls while the keyboard is open', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    restoreWindowScrollYAfterTest();

    await render(
      <KeyboardDrawer modal>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    onTestFinished(() => {
      scrollToSpy.mockRestore();
    });

    // Simulates WebKit's native reveal scroll escaping the scroll lock.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    window.dispatchEvent(new Event('scroll'));

    // Must restore instantly so the following measurements read the resting page; the
    // two-argument form would obey a global `scroll-behavior: smooth` and animate.
    expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
  });

  it('does not restore the page scroll position for a non-modal drawer', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    restoreWindowScrollYAfterTest();

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    onTestFinished(() => {
      scrollToSpy.mockRestore();
    });

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    window.dispatchEvent(new Event('scroll'));

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('does not treat a small visual viewport reduction as the software keyboard', async () => {
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

    const viewport = screen.getByTestId('viewport');
    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');

    setScrollSize(scroll, 420, 1200);

    // A reduction of 50px is below KEYBOARD_RESIZE_THRESHOLD (60px), so it is treated as
    // browser chrome movement rather than the software keyboard: no inset, no scroll slack.
    input.focus();
    visualViewport.resize(750);
    await flushMicrotasks();

    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    });
    expect(scroll.style.paddingBottom).toBe('20px');
    expect(scroll.style.overflowAnchor).toBe('');
  });

  it('computes the keyboard inset from a non-zero visual viewport offset', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const input = screen.getByTestId('input');

    input.focus();
    // The visual viewport shrinks to 500 and is offset 40px down within the layout viewport.
    visualViewport.scroll(40, 500);
    await flushMicrotasks();

    await waitFor(() => {
      // inset = innerHeight - min(innerHeight, offsetTop + height) = 800 - (40 + 500) = 260.
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('260px');
    });
  });

  it.each(['explicit', 'implicit'])(
    'preserves preventScroll after activating an %s label with no input focused',
    async (association) => {
      const field = () => <input data-testid="input" id="note" type="text" />;
      await render(
        <KeyboardDrawer initialFocus={false}>
          <label data-testid="label" for={association === 'explicit' ? 'note' : undefined}>
            <span data-testid="label-text">Note</span>
            {association === 'implicit' && field()}
          </label>
          {association === 'explicit' && field()}
        </KeyboardDrawer>,
      );

      const label = screen.getByTestId('label');
      const input = screen.getByTestId('input');
      const labelText = screen.getByTestId('label-text');
      expect(input).not.toHaveFocus();
      const focusSpy = vi.spyOn(input, 'focus');
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      input.addEventListener('focus', onFocus);
      input.addEventListener('blur', onBlur);
      const inputClickEvents: MouseEvent[] = [];
      let focusCallsDuringActivation = 0;
      input.addEventListener('click', (clickEvent) => {
        inputClickEvents.push(clickEvent);
        focusCallsDuringActivation = focusSpy.mock.calls.length;
      });
      const labelClickEvents: MouseEvent[] = [];
      label.addEventListener('click', (clickEvent) => {
        if (clickEvent.target === labelText) {
          labelClickEvents.push(clickEvent);
        }
      });
      stubElementFromPoint(document, () => labelText);

      await fireTouch.start(labelText, { touches: [{ clientX: 24, clientY: 48 }] });

      const touchEnd = await dispatchTouchEnd(labelText, { clientX: 24, clientY: 48 });

      expect(touchEnd.defaultPrevented).toBe(true);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(labelClickEvents).toHaveLength(1);
      expect(labelClickEvents[0].clientX).toBe(24);
      expect(labelClickEvents[0].clientY).toBe(48);
      expect(labelClickEvents[0].detail).toBe(1);
      expect(labelClickEvents[0].defaultPrevented).toBe(false);
      expect(inputClickEvents).toHaveLength(1);
      // WebKit's label default action refocuses without preventScroll after forwarding
      // the click. Reapply it after activation without emitting a new focus/blur cycle.
      expect(focusCallsDuringActivation).toBe(1);
      expect(focusSpy).toHaveBeenCalledTimes(2);
      expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).not.toHaveBeenCalled();
      expect(input).toHaveFocus();
    },
  );

  it('preserves a focus change from a label click handler', async () => {
    await render(
      <KeyboardDrawer initialFocus={false}>
        <label data-testid="label" for="note">
          Note
        </label>
        <input data-testid="input" id="note" />
        <button data-testid="other" type="button">
          Other
        </button>
      </KeyboardDrawer>,
    );

    const label = screen.getByTestId('label');
    const input = screen.getByTestId('input');
    const other = screen.getByTestId('other');
    label.addEventListener('click', (event) => {
      event.preventDefault();
      other.focus();
    });
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => label);

    await fireTouch.start(label, { touches: [{ clientX: 24, clientY: 48 }] });
    await dispatchTouchEnd(label, { clientX: 24, clientY: 48 });

    expect(other).toHaveFocus();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('focuses a contentEditable element on touchend', async () => {
    await render(
      <KeyboardDrawer>
        <div data-testid="editor" contenteditable="true">
          Edit me
        </div>
      </KeyboardDrawer>,
    );

    const editor = screen.getByTestId('editor');
    const focusSpy = vi.spyOn(editor, 'focus');
    stubElementFromPoint(document, () => editor);

    await fireTouch.start(editor, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(editor, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('focuses the editing host when tapping a nested element inside a contentEditable', async () => {
    await render(
      <KeyboardDrawer>
        <div data-testid="editor" contenteditable="true">
          <span data-testid="inner">Edit me</span>
        </div>
      </KeyboardDrawer>,
    );

    const editor = screen.getByTestId('editor');
    const inner = screen.getByTestId('inner');
    // Taps on rich-text content land on inherited-editable descendants, which are
    // not focusable themselves; the editing host must receive focus instead.
    stubElementFromPoint(document, () => inner);

    await fireTouch.start(inner, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(inner, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(editor).toHaveFocus();
  });

  it('probes nearby points to resolve a keyboard input retargeted on touchend', async () => {
    await render(
      <KeyboardDrawer>
        <div data-testid="wrapper" style={{ padding: '20px' }}>
          <input data-testid="input" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const wrapper = screen.getByTestId('wrapper');
    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    // The tap point resolves to the wrapper; only a point 16px below resolves to the input,
    // so the input can only be found via the hit-slop probe (not the native event target).
    stubElementFromPoint(document, (x, y) => (y === 16 ? input : wrapper));

    await fireTouch.start(wrapper, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(wrapper, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does not focus a keyboard input when the touch moves past the tap threshold', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    // Moving past INPUT_TAP_MOVE_THRESHOLD (10px) marks the gesture as a scroll, not a tap.
    await fireTouch.move(input, { touches: [{ clientX: 0, clientY: 80 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 80 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(input, { touches: [{ clientX: 0, clientY: 5 }] });
    const shortMoveTouchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 5 });

    expect(shortMoveTouchEnd.defaultPrevented).toBe(true);
    expect(input).toHaveFocus();
  });

  it('restores the previous scroll slack when focus moves to a different scroll container', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <div
          data-testid="scroll1"
          style={{ height: '200px', overflowY: 'auto', paddingBottom: '10px' }}
        >
          <div style={{ height: '600px' }} />
          <input data-testid="input1" type="text" />
        </div>
        <div
          data-testid="scroll2"
          style={{ height: '200px', overflowY: 'auto', paddingBottom: '10px' }}
        >
          <div style={{ height: '600px' }} />
          <input data-testid="input2" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const scroll1 = screen.getByTestId('scroll1');
    const scroll2 = screen.getByTestId('scroll2');
    const input1 = screen.getByTestId('input1');
    const input2 = screen.getByTestId('input2');

    const rectFor = (top: number) => () => new DOMRect(0, top, 320, 40);

    for (const scroll of [scroll1, scroll2]) {
      setScrollSize(scroll, 200, 800);
    }
    // Both containers extend below the reduced viewport bottom (500), so each needs slack.
    scroll1.getBoundingClientRect = rectFor(520);
    scroll2.getBoundingClientRect = rectFor(560);
    input1.getBoundingClientRect = rectFor(540);
    input2.getBoundingClientRect = rectFor(580);

    input1.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll1.style.paddingBottom)).toBeGreaterThan(10);
    });

    input2.focus();
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll2.style.paddingBottom)).toBeGreaterThan(10);
    });
    expect(scroll1.style.paddingBottom).toBe('10px');
    expect(scroll1.style.overflowAnchor).toBe('');
  });

  it('does not steal a tap that lands on an interactive element near a keyboard input', async () => {
    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
        <button data-testid="clear" type="button">
          Clear
        </button>
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const clear = screen.getByTestId('clear');
    const focusSpy = vi.spyOn(input, 'focus');
    // The tap lands exactly on the button; only the hit-slop probe points
    // resolve to the input. The probe must not steal the button's tap.
    stubElementFromPoint(document, (x, y) => (x === 0 && y === 0 ? clear : input));

    await fireTouch.start(clear, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(clear, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('preserves native taps on keyboard inputs while pinch-zoomed', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);

    await render(
      <KeyboardDrawer>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const focusSpy = vi.spyOn(input, 'focus');
    stubElementFromPoint(document, () => input);

    visualViewport.setScale(1.5);
    await flushMicrotasks();

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });

    const touchEnd = await dispatchTouchEnd(input, { clientX: 0, clientY: 0 });

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('restores slack from a removed scroll container before adjusting a new one', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(500);

    await render(
      <KeyboardDrawer initialFocus={false}>
        <div data-testid="scroll1" style={{ overflowY: 'auto', paddingBottom: '10px' }}>
          <input data-testid="input1" type="text" />
        </div>
        <div data-testid="scroll2" style={{ overflowY: 'auto' }}>
          <input data-testid="input2" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const scroll1 = screen.getByTestId('scroll1');
    const scroll2 = screen.getByTestId('scroll2');
    const input1 = screen.getByTestId('input1');
    const input2 = screen.getByTestId('input2');
    const rect = (top: number, bottom: number) => new DOMRect(0, top, 320, bottom - top);

    for (const scroll of [scroll1, scroll2]) {
      setScrollSize(scroll, 200, 800);
      scroll.getBoundingClientRect = () => rect(300, 700);
    }
    input1.getBoundingClientRect = () => rect(620, 660);
    input2.getBoundingClientRect = () => rect(620, 660);

    input1.focus();
    visualViewport.resize(500);
    await flushMicrotasks();
    await waitFor(() => {
      expect(Number.parseFloat(scroll1.style.paddingBottom)).toBeGreaterThan(10);
    });

    Object.defineProperty(scroll1, 'isConnected', { configurable: true, value: false });
    input2.focus();
    await flushMicrotasks();

    await waitFor(() => {
      expect(Number.parseFloat(scroll2.style.paddingBottom)).toBeGreaterThan(0);
    });
    expect(scroll1.style.paddingBottom).toBe('10px');
    expect(scroll1.style.overflowAnchor).toBe('');
  });

  it('clears inset and slack when the focused field is removed', async () => {
    mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(500);

    await render(
      <KeyboardDrawer initialFocus={false}>
        <div data-testid="scroll" style={{ overflowY: 'auto', paddingBottom: '10px' }}>
          <input data-testid="input" type="text" />
        </div>
      </KeyboardDrawer>,
    );

    const viewport = screen.getByTestId('viewport');
    const scroll = screen.getByTestId('scroll');
    const input = screen.getByTestId('input');
    setScrollSize(scroll, 200, 800);
    scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 400);
    input.getBoundingClientRect = () => new DOMRect(0, 620, 320, 40);

    input.focus();
    visualViewport.resize(500);
    await flushMicrotasks();
    await waitFor(() => {
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeGreaterThan(10);
    });

    const nativeContains = viewport.contains.bind(viewport);
    viewport.contains = (candidate) => (candidate === input ? false : nativeContains(candidate));
    visualViewport.resize(490);
    await flushAnimationFrames(2);
    await flushMicrotasks();

    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    expect(scroll.style.paddingBottom).toBe('10px');
  });

  it('captures an initially focused input without attempting an unnecessary page restore', async () => {
    mockWindowInnerHeight(800);
    mockVisualViewport(500);
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    onTestFinished(() => {
      scrollToSpy.mockRestore();
    });

    await render(() => (
      <KeyboardDrawer modal initialFocus={false}>
        <input ref={focusElement} data-testid="input" type="text" />
      </KeyboardDrawer>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveFocus();
    await waitFor(() => {
      expect(screen.getByTestId('viewport').style.getPropertyValue('--drawer-keyboard-inset')).toBe(
        '300px',
      );
    });
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('ignores a directly captured touch target while a closed drawer remains mounted', async () => {
    await render(
      <Drawer.Root
        defaultOpen
        modal={false}
        onOpenChange={(nextOpen: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => {
          if (!nextOpen) {
            eventDetails.preventUnmountOnClose();
          }
        }}
      >
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup initialFocus={false} data-testid="popup">
                <DirectVirtualKeyboardTouchTarget />
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>,
    );

    const input = screen.getByTestId('input');
    stubElementFromPoint(document, () => input);

    screen.getByRole('button', { name: 'Close' }).click();
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed', '');
    });

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });
    await fireTouch.move(input, { touches: [] });
    input.dispatchEvent(createNativeTouchEvent('touchend', { clientX: 0, clientY: 0 }));

    expect(input).not.toHaveFocus();
  });

  it('does not focus a lift-point target outside the drawer', async () => {
    await render(
      <div>
        <input data-testid="outside" type="text" />
        <KeyboardDrawer initialFocus={false}>
          <input data-testid="inside" type="text" />
        </KeyboardDrawer>
      </div>,
    );

    const inside = screen.getByTestId('inside');
    const outside = screen.getByTestId('outside');
    stubElementFromPoint(document, () => outside);

    await fireTouch.start(inside, { touches: [{ clientX: 0, clientY: 0 }] });
    inside.dispatchEvent(createNativeTouchEvent('touchend', { clientX: 0, clientY: 0 }));

    expect(inside).not.toHaveFocus();
    expect(outside).not.toHaveFocus();
  });

  it('falls back to the touch target when point lookup misses', async () => {
    await render(
      <KeyboardDrawer initialFocus={false}>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    stubElementFromPoint(document, () => null);

    await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });
    const touchEnd = createNativeTouchEvent('touchend', { clientX: 0, clientY: 0 });
    input.dispatchEvent(touchEnd);

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(input).toHaveFocus();
  });

  it('uses the remaining touch and MouseEvent fallback for keyboard taps', async () => {
    await render(
      <KeyboardDrawer initialFocus={false}>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    const pointerEventDescriptor = Object.getOwnPropertyDescriptor(window, 'PointerEvent');
    stubElementFromPoint(document, () => null);
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: undefined });
    onTestFinished(() => {
      if (pointerEventDescriptor) {
        Object.defineProperty(window, 'PointerEvent', pointerEventDescriptor);
      }
    });

    await fireTouch.start(input, { touches: [{ clientX: 10, clientY: 20 }] });
    const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperties(touchEnd, {
      changedTouches: { configurable: true, value: [] },
      touches: { configurable: true, value: [{ clientX: 10, clientY: 20 }] },
    });
    input.dispatchEvent(touchEnd);

    expect(touchEnd.defaultPrevented).toBe(true);
    expect(input).toHaveFocus();
  });

  it('ignores a keyboard tap whose native target is not an element', async () => {
    await render(
      <KeyboardDrawer initialFocus={false}>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    stubElementFromPoint(document, () => null);

    await fireTouch.start(input, { touches: [{ clientX: 10, clientY: 20 }] });
    const touchEnd = createNativeTouchEvent('touchend', { clientX: 10, clientY: 20 });
    touchEnd.composedPath = () => [window];
    input.dispatchEvent(touchEnd);

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(input).not.toHaveFocus();
  });

  it('ignores touchend without a lift coordinate', async () => {
    await render(
      <KeyboardDrawer initialFocus={false}>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    const input = screen.getByTestId('input');
    await fireTouch.start(input, { touches: [{ clientX: 10, clientY: 20 }] });
    const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperties(touchEnd, {
      changedTouches: { configurable: true, value: [] },
      touches: { configurable: true, value: [] },
    });
    input.dispatchEvent(touchEnd);
    await flushMicrotasks();

    expect(input).not.toHaveFocus();
  });

  it('does not align inputs when visualViewport is unavailable', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    onTestFinished(() => {
      if (originalDescriptor) {
        Object.defineProperty(window, 'visualViewport', originalDescriptor);
      }
    });

    await render(
      <KeyboardDrawer initialFocus={false}>
        <input data-testid="input" type="text" />
      </KeyboardDrawer>,
    );

    screen.getByTestId('input').focus();
    await flushAnimationFrames(2);
    await flushMicrotasks();

    expect(screen.getByTestId('viewport').style.getPropertyValue('--drawer-keyboard-inset')).toBe(
      '0px',
    );
  });

  describe('layout viewport resized for the keyboard (Chrome on iOS)', () => {
    async function renderKeyboardDrawer() {
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
      // Under fake timers, the render moves the clock with `vi.setSystemTime`, which also moves
      // each pending timer by 1 ms. The frame callbacks of the mount then miss the next frame.
      vi.advanceTimersToNextFrame();
    }

    // New Chrome on iOS shrinks `svh` for the keyboard before resizing the layout viewport.
    function mockSmallViewportHeight(initialHeight: number) {
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetHeight',
      )!;
      let smallViewportHeight = initialHeight;

      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.style.height === '100svh'
            ? smallViewportHeight
            : originalDescriptor.get!.call(this);
        },
      });
      onTestFinished(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalDescriptor);
      });

      return {
        set(nextHeight: number) {
          smallViewportHeight = nextHeight;
        },
      };
    }

    function mockScrollGeometry(scroll: HTMLElement, input: HTMLElement) {
      setScrollSize(scroll, 380, 1200);
      // The shrunken viewport keeps the scroller above the keyboard.
      scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, 380);
      input.getBoundingClientRect = () => new DOMRect(0, 650 - scroll.scrollTop, 320, 40);
    }

    it('applies no keyboard inset or slack when the small viewport follows the keyboard', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const smallViewport = mockSmallViewportHeight(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      // The scroller lays out inside the layout viewport; against the full-height one, the
      // keyboard would overlap its bottom 220px.
      scroll.getBoundingClientRect = () => new DOMRect(0, window.innerHeight - 500, 320, 420);

      input.focus();
      smallViewport.set(500);
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
      expect(scroll.style.paddingBottom).toBe('20px');

      innerHeight.resize(650);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
      expect(scroll.style.paddingBottom).toBe('20px');
    });

    it('aligns the focused field once the layout viewport has shrunk to the visual viewport', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      mockScrollGeometry(scroll, input);
      scrollInstantly(scroll);

      // The visual viewport shrinks first; the layout viewport follows a frame later.
      input.focus({ preventScroll: true });
      scroll.scrollTop = 0;
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      innerHeight.resize(500);
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();

      const inputRect = input.getBoundingClientRect();
      expect((inputRect.top + inputRect.bottom) / 2).toBeCloseTo((100 + 480) / 2, 0);
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
      expect(scroll.style.paddingBottom).toBe('20px');
    });

    it('scrolls the focused field once the layout viewport reaches the visual viewport', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const smallViewport = mockSmallViewportHeight(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      mockScrollGeometry(scroll, input);
      const scrollToSpy = vi.spyOn(scroll, 'scrollTo').mockImplementation(() => {});

      input.focus({ preventScroll: true });
      smallViewport.set(500);
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      // The layout viewport can pause on its way down.
      innerHeight.resize(700);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      innerHeight.resize(600);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(scrollToSpy).not.toHaveBeenCalled();

      innerHeight.resize(500);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });

    it('waits for the layout viewport to grow to a shorter keyboard before scrolling', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const smallViewport = mockSmallViewportHeight(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      mockScrollGeometry(scroll, input);
      const scrollToSpy = vi.spyOn(scroll, 'scrollTo').mockImplementation(() => {});

      input.focus({ preventScroll: true });
      smallViewport.set(500);
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      innerHeight.resize(500);
      await vi.advanceTimersByTimeAsync(2000);
      await flushMicrotasks();
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
      scrollToSpy.mockClear();

      // The keyboard gets shorter while staying open; the layout viewport follows later.
      smallViewport.set(540);
      visualViewport.resize(540);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(scrollToSpy).not.toHaveBeenCalled();

      innerHeight.resize(540);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });

    it('does not treat a plain resize of both viewports as the software keyboard', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      mockScrollGeometry(scroll, input);
      const scrollToSpy = vi.spyOn(scroll, 'scrollTo').mockImplementation(() => {});

      input.focus();
      await vi.advanceTimersByTimeAsync(100);
      await flushMicrotasks();

      // A window resize (or rotation) moves both viewports together.
      visualViewport.resize(500);
      innerHeight.resize(500);
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect(['', '0px']).toContain(viewport.style.getPropertyValue('--drawer-keyboard-inset'));
      expect(scroll.style.paddingBottom).toBe('20px');
    });

    it('clears the keyboard inset and slack once the layout viewport catches up with the visual viewport', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      // Place the scroller so the keyboard overlaps its bottom 220px.
      let scrollBottom = 720;
      scroll.getBoundingClientRect = () => new DOMRect(0, scrollBottom - 420, 320, 420);

      // Let the alignment passes finish so only the resize can re-measure.
      input.focus();
      visualViewport.resize(500);
      await vi.advanceTimersByTimeAsync(2000);
      await flushMicrotasks();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
      expect(scroll.style.paddingBottom).toBe('240px');

      // The layout viewport catches up and the fixed drawer lays out inside it.
      scrollBottom = 480;
      innerHeight.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
      expect(scroll.style.paddingBottom).toBe('20px');
    });

    it('preserves native taps while the keyboard is open and refocuses once it closes', async () => {
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      useFakeTimers();

      await renderKeyboardDrawer();

      const input = screen.getByTestId('input');

      const tap = async () => {
        await fireTouch.start(input, { touches: [{ clientX: 0, clientY: 0 }] });
        return dispatchTouchEnd(input, { clientX: 0, clientY: 0 });
      };

      input.focus();
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      innerHeight.resize(500);
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();

      const focusSpy = vi.spyOn(input, 'focus');
      stubElementFromPoint(document, () => input);

      // The overlap is gone, but the keyboard is still open.
      expect((await tap()).defaultPrevented).toBe(false);
      expect(focusSpy).not.toHaveBeenCalled();

      visualViewport.resize(800);
      innerHeight.resize(800);
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();

      expect((await tap()).defaultPrevented).toBe(true);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });
  });

  describe('alignment on Android', () => {
    // Visible band above a 500px keyboard: [300, 500].
    async function renderAlignmentDrawer(inputTop: number, textareaHeight?: number) {
      const inputHeight = textareaHeight ?? 40;
      await render(
        <KeyboardDrawer>
          <Drawer.Content data-testid="scroll" style={{ height: '420px', overflowY: 'auto' }}>
            <div style={{ height: '900px' }} />
            {textareaHeight === undefined ? (
              <input data-testid="input" type="text" />
            ) : (
              <textarea data-testid="input" />
            )}
          </Drawer.Content>
        </KeyboardDrawer>,
      );

      const scroll = screen.getByTestId('scroll');
      const input = screen.getByTestId('input');

      setScrollSize(scroll, 420, 1200);
      scroll.getBoundingClientRect = () => new DOMRect(0, 300, 320, 420);
      input.getBoundingClientRect = () =>
        new DOMRect(0, inputTop - scroll.scrollTop, 320, inputHeight);

      return { scroll, input };
    }

    function spyOnScrollTo(scroll: HTMLElement) {
      const scrollToSpy = vi.fn((options?: ScrollToOptions | number) => {
        if (typeof options === 'object' && options !== null && options.top !== undefined) {
          scroll.scrollTop = options.top;
        }
      });
      scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;
      return scrollToSpy;
    }

    it.each([
      { name: 'leaves a visible field in place on Android', android: true, expected: [] },
      { name: 'centers a visible field elsewhere', android: false, expected: [50] },
      {
        name: 'reveals a covered field by the minimum distance on Android',
        android: true,
        inputTop: 650,
        expected: [206],
      },
      { name: 'centers a covered field elsewhere', android: false, inputTop: 650, expected: [270] },
      {
        name: 'leaves a tall textarea that fits the visible band in place on Android',
        android: true,
        inputTop: 320,
        textareaHeight: 175,
        expected: [],
      },
      {
        name: 'reveals a covered tall textarea without hiding its bottom on Android',
        android: true,
        inputTop: 350,
        textareaHeight: 190,
        expected: [45],
      },
      {
        name: 'aligns the top of a textarea taller than the visible band on Android',
        android: true,
        inputTop: 350,
        textareaHeight: 300,
        expected: [50],
      },
    ])('$name', async ({ android, inputTop = 430, textareaHeight, expected }) => {
      setAndroid(android);
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);

      const { scroll, input } = await renderAlignmentDrawer(inputTop, textareaHeight);
      const scrollToSpy = spyOnScrollTo(scroll);
      expect(scroll.scrollTop).toBe(0);

      input.focus({ preventScroll: true });
      visualViewport.resize(500);
      await flushMicrotasks();
      await flushAnimationFrames(10);
      await flushMicrotasks();

      expect(scrollToSpy.mock.calls.map(([options]) => (options as ScrollToOptions).top)).toEqual(
        expected,
      );
    });

    it('re-issues a canceled alignment scroll within a few frames', async () => {
      setAndroid(true);
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      useFakeTimers();

      const { scroll, input } = await renderAlignmentDrawer(650);
      // The mock never moves, standing in for a smooth scroll canceled by Chrome's
      // focused-editable reveal.
      const scrollToSpy = vi.fn();
      scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;
      expect(scroll.scrollTop).toBe(0);

      input.focus({ preventScroll: true });
      visualViewport.resize(500);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      await flushMicrotasks();
      expect(scrollToSpy).toHaveBeenCalledTimes(1);

      for (let i = 0; i < 4; i += 1) {
        vi.advanceTimersToNextFrame();
      }
      await flushMicrotasks();
      expect(scrollToSpy).toHaveBeenCalledTimes(2);
      expect(scrollToSpy).toHaveBeenLastCalledWith(expect.objectContaining({ top: 206 }));
    });

    it.each([
      {
        name: 'reveals a covered field when the keyboard shrinks the layout viewport on Android',
        android: true,
        expected: [206],
      },
      {
        name: 'does not treat a shrinking layout viewport as the keyboard elsewhere',
        android: false,
        expected: [],
      },
    ])('$name', async ({ android, expected }) => {
      setAndroid(android);
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);

      const { scroll, input } = await renderAlignmentDrawer(650);
      const scrollToSpy = spyOnScrollTo(scroll);
      expect(scroll.scrollTop).toBe(0);

      input.focus({ preventScroll: true });
      // `interactive-widget=resizes-content`: both viewports shrink together.
      innerHeight.resize(500);
      visualViewport.resize(500);
      await flushMicrotasks();
      await flushAnimationFrames(10);
      await flushMicrotasks();

      expect(scrollToSpy.mock.calls.map(([options]) => (options as ScrollToOptions).top)).toEqual(
        expected,
      );
    });

    it.each([
      { name: 'adds no scroll slack for a sub-pixel overlap', bottom: 500.4, expected: '' },
      { name: 'adds scroll slack for an overlap above a pixel', bottom: 502, expected: '18px' },
    ])('$name', async ({ bottom, expected }) => {
      setAndroid(true);
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);

      const { scroll, input } = await renderAlignmentDrawer(430);
      scroll.getBoundingClientRect = () => new DOMRect(0, bottom - 420, 320, 420);
      expect(scroll.style.paddingBottom).toBe('');

      input.focus({ preventScroll: true });
      innerHeight.resize(500);
      visualViewport.resize(500);
      await flushMicrotasks();
      await flushAnimationFrames(10);
      await flushMicrotasks();

      expect(scroll.style.paddingBottom).toBe(expected);
    });

    it('does not treat a rotation as the keyboard on Android', async () => {
      setAndroid(true);
      const innerHeight = mockResizableInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      onTestFinished(() => {
        if (innerWidthDescriptor) {
          Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
        }
      });

      const { scroll, input } = await renderAlignmentDrawer(650);
      const scrollToSpy = vi.fn();
      scroll.scrollTo = scrollToSpy as unknown as typeof scroll.scrollTo;

      input.focus({ preventScroll: true });
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: window.innerWidth + 400,
      });
      innerHeight.resize(500);
      visualViewport.resize(500);
      await flushMicrotasks();
      await flushAnimationFrames(10);
      await flushMicrotasks();

      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe('render of the scroll container', () => {
    it('keeps the keyboard scroll slack when a render writes the style of the scroll container again', async () => {
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const paddingBottom = shallowRef('20px');
      const renderCount = shallowRef(0);

      await render(() => (
        <KeyboardDrawer>
          <Drawer.Content
            data-testid="scroll"
            data-render={renderCount.value}
            style={{ height: '420px', overflowY: 'auto', paddingBottom: paddingBottom.value }}
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

      input.focus();
      visualViewport.resize(500);
      await flushMicrotasks();
      await waitFor(() => {
        expect(scroll.style.paddingBottom).toBe('240px');
      });

      renderCount.value += 1;
      await flushMicrotasks();
      expect(scroll.getAttribute('data-render')).toBe('1');
      expect(scroll.style.paddingBottom).toBe('240px');

      paddingBottom.value = '30px';
      await flushMicrotasks();
      expect(scroll.style.paddingBottom).toBe('250px');

      input.blur();
      await flushMicrotasks();
      await waitFor(() => {
        expect(scroll.style.paddingBottom).toBe('30px');
      });
      expect(scroll.style.overflowAnchor).toBe('');
    });

    it('restores a padding of the scroll container that has a fraction of a pixel', async () => {
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);

      await render(
        <KeyboardDrawer>
          <Drawer.Content
            data-testid="scroll"
            style={{ height: '420px', overflowY: 'auto', paddingBottom: '20.7812px' }}
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
      const paddingBottom = scroll.style.paddingBottom;

      input.focus();
      visualViewport.resize(500);
      await flushMicrotasks();
      await waitFor(() => {
        expect(Number.parseFloat(scroll.style.paddingBottom)).toBeCloseTo(240.78, 1);
      });
      // The observer of the provider sees the write of the provider in a microtask.
      await flushMicrotasks();
      expect(Number.parseFloat(scroll.style.paddingBottom)).toBeCloseTo(240.78, 1);

      input.blur();
      await flushMicrotasks();
      await waitFor(() => {
        expect(scroll.style.paddingBottom).toBe(paddingBottom);
      });
    });
  });

  describe('KeepAlive', () => {
    it('VUE-5: removes its listeners and the keyboard inset while KeepAlive holds the drawer, and adds them again at the activation', async () => {
      mockWindowInnerHeight(800);
      const visualViewport = mockVisualViewport(800);
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => (
          <KeyboardDrawer>
            <input data-testid="input" type="text" />
          </KeyboardDrawer>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });

      await render(() => (
        <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
      ));
      await flushMicrotasks();

      const viewport = screen.getByTestId('viewport');
      screen.getByTestId('input').focus();
      visualViewport.resize(500);
      await flushMicrotasks();
      await waitFor(() => {
        expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
      });
      expect(visualViewport.listeners.get('resize')?.size).toBe(1);

      shown.value = false;
      await flushMicrotasks();
      expect(visualViewport.listeners.get('resize')?.size).toBe(0);
      expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('');

      shown.value = true;
      await flushMicrotasks();
      expect(visualViewport.listeners.get('resize')?.size).toBe(1);
    });
  });
});
