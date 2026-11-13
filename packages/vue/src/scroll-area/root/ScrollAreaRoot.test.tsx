import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { styleDisableScrollbar } from '../../utils/styles';
import { SCROLL_TIMEOUT } from '../constants';
import ScrollAreaRootHydration from './ScrollAreaRootHydration.test.vue';

const VIEWPORT_SIZE = 200;
const SCROLLABLE_CONTENT_SIZE = 1000;
const SCROLLBAR_WIDTH = 10;
const SCROLLBAR_HEIGHT = 10;

function queryDisableScrollbarStyles(root: ParentNode) {
  return Array.from(root.querySelectorAll('style')).filter((element) =>
    element.textContent?.includes('.vase-ui-disable-scrollbar'),
  );
}

function getAttributeFlags(element: Element, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, element.hasAttribute(name)]));
}

async function withMockResizeObserver(run: (notifyResizeObserver: () => void) => Promise<void>) {
  const originalResizeObserver = window.ResizeObserver;
  const observers = new Set<ResizeObserverMock>();

  class ResizeObserverMock implements ResizeObserver {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe() {
      observers.add(this);
    }

    unobserve() {}

    disconnect() {
      observers.delete(this);
    }

    takeRecords() {
      return [];
    }
  }

  window.ResizeObserver = ResizeObserverMock;

  try {
    await run(() => {
      expect(observers.size).toBeGreaterThan(0);
      observers.forEach((observer) => observer.callback([], observer));
    });
  } finally {
    window.ResizeObserver = originalResizeObserver;
  }
}

describe('<ScrollArea.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('data-scrolling attribute', () => {
    const { render: renderWithFakeTimers } = createRenderer();

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      expect(root).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(root).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(root).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });

      expect(root).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(root).not.toHaveAttribute('data-scrolling');
    });
  });

  describe.skipIf(isJSDOM)('sizing', () => {
    it('recomputes thumb size when becoming visible without requiring scroll', async () => {
      const visible = shallowRef(false);
      const App = defineComponent(() => () => (
        <>
          <button
            type="button"
            onClick={() => {
              visible.value = true;
            }}
          >
            show
          </button>
          <div style={{ display: visible.value ? 'block' : 'none' }}>
            <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
              <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
                <div
                  style={{
                    width: `${SCROLLABLE_CONTENT_SIZE}px`,
                    height: `${SCROLLABLE_CONTENT_SIZE}px`,
                  }}
                />
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" style={{ display: 'flex' }}>
                <ScrollArea.Thumb data-testid="vertical-thumb" style={{ paddingBlock: '8px' }} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </>
      ));

      await render(<App />);

      await fireEvent.click(screen.getByRole('button', { name: 'show' }));

      const verticalThumb = await screen.findByTestId('vertical-thumb');

      await waitFor(() => {
        // `0px` is the start value, so this assertion cannot pass before the thumb gets its size.
        expect(
          getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height'),
        ).not.toBe('0px');
      });
    });

    it('shows scrollbars after mount compute before the first ResizeObserver measurement', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        await render(
          <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
              <ScrollArea.Thumb data-testid="vertical-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>,
        );

        const verticalScrollbar = await screen.findByTestId('vertical-scrollbar');

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });

        notifyResizeObserver();
        await flushMicrotasks();

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });
      });
    });

    it('shows keepMounted scrollbar track and thumb after mount compute', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        await render(
          <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              data-testid="vertical-scrollbar"
              keepMounted
            >
              <ScrollArea.Thumb data-testid="vertical-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>,
        );

        const verticalScrollbar = await screen.findByTestId('vertical-scrollbar');
        const verticalThumb = await screen.findByTestId('vertical-thumb');

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });
        await waitFor(() => {
          expect(getComputedStyle(verticalThumb).visibility).toBe('visible');
        });

        notifyResizeObserver();
        await flushMicrotasks();

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });
        await waitFor(() => {
          expect(getComputedStyle(verticalThumb).visibility).toBe('visible');
        });
      });
    });

    it('should correctly set thumb height and width based on scrollable content', async () => {
      await render(
        <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal-scrollbar">
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      const expectedThumbSize = `${(VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE) * VIEWPORT_SIZE}px`;

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          expectedThumbSize,
        );
      });
      await waitFor(() => {
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(expectedThumbSize);
      });
    });

    it('should not add padding for overlay scrollbars', async () => {
      await render(
        <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            style={{ width: `${SCROLLBAR_WIDTH}px`, height: '100%' }}
          />
          <ScrollArea.Scrollbar
            orientation="horizontal"
            style={{ height: `${SCROLLBAR_HEIGHT}px`, width: '100%' }}
          />
        </ScrollArea.Root>,
      );

      const contentWrapper = screen.getByTestId('viewport').firstElementChild!;
      const style = getComputedStyle(contentWrapper);

      expect(style.paddingLeft).toBe('0px');
      expect(style.paddingRight).toBe('0px');
      expect(style.paddingBottom).toBe('0px');
    });

    it('accounts for scrollbar padding', async () => {
      const PADDING = 8;

      await render(
        <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            style={{ paddingBlock: `${PADDING}px` }}
          >
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            data-testid="horizontal-scrollbar"
            style={{ paddingInline: `${PADDING}px` }}
          >
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      const expectedThumbSize = `${(VIEWPORT_SIZE - PADDING * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`;

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          expectedThumbSize,
        );
      });
      await waitFor(() => {
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(expectedThumbSize);
      });
    });

    it('accounts for scrollbar margin', async () => {
      const margin = 11;
      const viewportSize = 390;

      await render(
        <ScrollArea.Root style={{ width: `${viewportSize}px`, height: `${viewportSize}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            style={{ marginBlock: `${margin}px` }}
          >
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            data-testid="horizontal-scrollbar"
            style={{ marginInline: `${margin}px` }}
          >
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');
      const expectedThumbSize = `${(viewportSize - margin * 2) * (viewportSize / SCROLLABLE_CONTENT_SIZE)}px`;

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          expectedThumbSize,
        );
      });
      await waitFor(() => {
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(expectedThumbSize);
      });
    });

    it('accounts for thumb margin', async () => {
      const MARGIN = 8;

      await render(
        <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
            <ScrollArea.Thumb data-testid="vertical-thumb" style={{ marginBlock: `${MARGIN}px` }} />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal-scrollbar">
            <ScrollArea.Thumb
              data-testid="horizontal-thumb"
              style={{ marginInline: `${MARGIN}px` }}
            />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      const expectedThumbSize = `${(VIEWPORT_SIZE - MARGIN * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`;

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          expectedThumbSize,
        );
      });
      await waitFor(() => {
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(expectedThumbSize);
      });
    });
  });

  describe.skipIf(isJSDOM)('overflow data attributes', () => {
    it('recomputes horizontal overflow edges when direction changes', async () => {
      const renderArea = (direction: 'ltr' | 'rtl') => (
        <DirectionProvider direction={direction}>
          <ScrollArea.Root
            data-testid="root"
            style={{
              width: `${VIEWPORT_SIZE}px`,
              height: `${VIEWPORT_SIZE}px`,
              direction,
            }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div
                style={{ width: `${SCROLLABLE_CONTENT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>
      );

      const { rerender } = await render(renderArea('ltr'));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));

      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: maxScrollLeft / 2,
        },
      });

      const xEdges = ['data-overflow-x-start', 'data-overflow-x-end'];

      await waitFor(() => {
        expect(getAttributeFlags(root, xEdges)).toEqual({
          'data-overflow-x-start': true,
          'data-overflow-x-end': true,
        });
      });

      await rerender(renderArea('rtl'));

      viewport.scrollLeft = -maxScrollLeft;
      await flushMicrotasks();

      await waitFor(() => {
        expect(getAttributeFlags(root, xEdges)).toEqual({
          'data-overflow-x-start': true,
          'data-overflow-x-end': false,
        });
      });
    });

    it('correctly handles RTL', async () => {
      await render(
        <DirectionProvider direction="rtl">
          <ScrollArea.Root
            data-testid="root"
            style={{
              width: `${VIEWPORT_SIZE}px`,
              height: `${VIEWPORT_SIZE}px`,
              direction: 'rtl',
            }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: `${SCROLLABLE_CONTENT_SIZE}px`, height: '200px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: 0,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      expect(root).not.toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: -maxScrollLeft / 2,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-overflow-x-start'));
      expect(root).toHaveAttribute('data-overflow-x-end');

      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: -maxScrollLeft,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-overflow-x-start'));
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });
  });

  describe('KeepAlive', () => {
    const { render: renderWithFakeTimers } = createRenderer();

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ends the scrolling state and clears its timers on deactivation', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
              {/* `pointer-events: none` isolates this from the browser's real pointer. A real
                  pointer that enters the viewport makes the next scroll a user scroll. */}
              <ScrollArea.Viewport
                data-testid="viewport"
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
              >
                <div style={{ width: '1000px', height: '1000px' }} />
              </ScrollArea.Viewport>
            </ScrollArea.Root>
          ) : null}
        </KeepAlive>
      ));

      await renderWithFakeTimers(<App />);
      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      // The count can hold a timer of Vue: the first app of a page starts one in a development
      // build. So the test compares counts. The scroll adds the two scroll timers of the root, one
      // for each axis, and the scroll end timer of the viewport. The deactivation must remove
      // these three timers and the animation wait timer of the viewport.
      const timersAfterMount = vi.getTimerCount();

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollTop: 100, scrollLeft: 100 } });

      expect(root).toHaveAttribute('data-scrolling', '');
      expect(vi.getTimerCount()).toBe(timersAfterMount + 3);

      visible.value = false;
      await nextTick();

      expect(vi.getTimerCount()).toBe(timersAfterMount - 1);

      visible.value = true;
      await nextTick();

      expect(root).not.toHaveAttribute('data-scrolling');
    });

    it('ends a drag on deactivation, and restores the scroll snap of the viewport', async () => {
      const visible = shallowRef(true);
      // `pointer-events: none` isolates this from the browser's real pointer.
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <ScrollArea.Root style={{ width: '200px', height: '200px', pointerEvents: 'none' }}>
              <ScrollArea.Viewport
                data-testid="viewport"
                style={{ width: '100%', height: '100%', scrollSnapType: 'y mandatory' }}
              >
                <div style={{ width: '200px', height: '1000px' }} />
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
                <ScrollArea.Thumb data-testid="thumb" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          ) : null}
        </KeepAlive>
      ));

      await renderWithFakeTimers(<App />);
      const viewport = screen.getByTestId('viewport');
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      });

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });

      expect(viewport.style.scrollSnapType).toBe('none');

      visible.value = false;
      await nextTick();
      visible.value = true;
      await nextTick();

      expect(viewport.style.scrollSnapType).toBe('y mandatory');

      await fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });

      expect(viewport.scrollTop).toBe(0);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('clears the hover state on deactivation', async () => {
      const visible = shallowRef(true);
      // `pointer-events: none` isolates this from the browser's real pointer.
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <ScrollArea.Root
              data-testid="root"
              style={{ width: '200px', height: '200px', pointerEvents: 'none' }}
            >
              <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
                <div style={{ width: '1000px', height: '1000px' }} />
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
            </ScrollArea.Root>
          ) : null}
        </KeepAlive>
      ));

      await renderWithFakeTimers(<App />);
      const root = screen.getByTestId('root');
      const scrollbar = screen.getByTestId('scrollbar');

      await fireEvent.pointerEnter(root, { pointerType: 'mouse' });

      expect(scrollbar).toHaveAttribute('data-hovering');

      visible.value = false;
      await nextTick();
      visible.value = true;
      await nextTick();

      expect(scrollbar).not.toHaveAttribute('data-hovering');
    });
  });

  describe('style element', () => {
    it('keeps one style element for two apps, and removes it with the last app', async () => {
      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);

      const first = await render(
        <CSPProvider nonce="test-nonce">
          <ScrollArea.Root />
        </CSPProvider>,
      );
      const second = await render(
        <CSPProvider nonce="test-nonce">
          <ScrollArea.Root />
        </CSPProvider>,
      );

      const styles = queryDisableScrollbarStyles(document);
      expect(styles).toHaveLength(1);
      expect(document.head.firstElementChild).toBe(styles[0]);
      expect(styles[0]).toHaveAttribute('nonce', 'test-nonce');
      expect(first.container.querySelector('style')).toBeNull();
      expect(second.container.querySelector('style')).toBeNull();

      first.unmount();

      expect(queryDisableScrollbarStyles(document)).toHaveLength(1);

      second.unmount();

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('follows disableStyleElements of the provider', async () => {
      const { setProps } = await render(
        <CSPProvider disableStyleElements>
          <ScrollArea.Root />
        </CSPProvider>,
      );

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);

      await setProps({ disableStyleElements: false });

      expect(queryDisableScrollbarStyles(document)).toHaveLength(1);

      await setProps({ disableStyleElements: true });

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('puts the style element in the shadow root of the root, and not in the document', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.append(container);
      const app = createApp({ render: () => <ScrollArea.Root /> });
      onTestFinished(() => {
        app.unmount();
        host.remove();
      });

      app.mount(container);
      await nextTick();

      const styles = queryDisableScrollbarStyles(shadowRoot);
      expect(styles).toHaveLength(1);
      expect(shadowRoot.firstElementChild).toBe(styles[0]);
      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('sets the nonce, so that a policy that needs the nonce accepts the style element', async () => {
      const frame = document.createElement('iframe');
      frame.srcdoc =
        '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src-elem \'nonce-test-nonce\'"></head><body></body></html>';
      const loaded = new Promise((resolve) => {
        frame.addEventListener('load', resolve, { once: true });
      });
      document.body.append(frame);
      onTestFinished(() => {
        frame.remove();
      });
      await loaded;
      const frameDocument = frame.contentDocument!;

      // A style element with no nonce gets no style sheet when the policy is in force.
      const control = frameDocument.createElement('style');
      control.textContent = 'body{margin:0}';
      frameDocument.head.append(control);
      expect(control.sheet).toBeNull();
      // The event of the control comes in a later task. Wait for it, so that the listener below
      // does not count it.
      await waitSingleFrame();
      await waitSingleFrame();

      const violations: Event[] = [];
      frameDocument.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event);
      });
      const container = frameDocument.createElement('div');
      frameDocument.body.append(container);
      const app = createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      });
      onTestFinished(() => {
        app.unmount();
      });

      app.mount(container);
      await waitSingleFrame();
      await waitSingleFrame();

      const styles = queryDisableScrollbarStyles(frameDocument);
      expect(styles).toHaveLength(1);
      expect(styles[0].parentElement).toBe(frameDocument.head);
      expect(styles[0].sheet).not.toBeNull();
      expect(violations).toHaveLength(0);
    });

    it('writes the nonce attribute on the style element of the first client render', () => {
      const container = document.createElement('div');
      document.body.append(container);
      const app = createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });

      app.mount(container);

      // The flush that removes this element comes after the mount.
      expect(container.querySelector('style')).toHaveAttribute('nonce', 'test-nonce');
    });
  });

  describe('hydration', () => {
    it.each([
      {
        name: 'a nonce',
        props: { nonce: 'test-nonce' },
        serverStyles: [{ nonce: 'test-nonce', text: styleDisableScrollbar.css }],
        count: 1,
        leaves: 'one shared style element',
      },
      {
        name: 'style elements off',
        props: { disableStyleElements: true },
        serverStyles: [],
        count: 0,
        leaves: 'no style element',
      },
    ])(
      'hydrates a root with $name, then leaves $leaves in the document',
      async ({ props, serverStyles, count }) => {
        const serverHtml = await renderOnServer(
          'src/scroll-area/root/ScrollAreaRootHydration.test.vue',
          props,
        );
        // A `<template>` element parses the HTML with no side effect.
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        const serverRoot = template.content.querySelector('[data-testid="root"]')!;
        const styles = Array.from(serverRoot.children).filter(
          (child) => child.localName === 'style',
        );
        expect(
          styles.map((style) => ({
            nonce: style.getAttribute('nonce'),
            text: style.textContent,
          })),
        ).toEqual(serverStyles);

        const { container } = await hydrate(ScrollAreaRootHydration, { serverHtml, props });

        expect(container.querySelector('style')).toBeNull();
        expect(queryDisableScrollbarStyles(document)).toHaveLength(count);
      },
    );
  });
});
