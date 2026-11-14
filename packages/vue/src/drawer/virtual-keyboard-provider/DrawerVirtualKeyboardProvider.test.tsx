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
    first.focus();
    scroll.scrollTop = 0;
    visualViewport.resize(keyboardViewportHeight);
    await flushMicrotasks();

    // Simulates the iOS keyboard's next-field arrow: focus moves with no touch events.
    second.focus();
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

    first.focus();
    visualViewport.resize(500);
    await flushMicrotasks();

    scrollToSpy.mockClear();

    second.focus();
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
});
