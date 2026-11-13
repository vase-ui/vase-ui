import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, defineComponent, isRef, KeepAlive, nextTick, onUpdated, shallowRef } from 'vue';
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
import { useScrollAreaRootContext } from './ScrollAreaRootContext';

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

      expect(
        getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height'),
      ).not.toBe('0px');
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

    it('recomputes corner size when content starts overflowing', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        const renderArea = (contentSize: number) => (
          <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: `${contentSize}px`, height: `${contentSize}px` }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              data-testid="scrollbar-vertical"
              style={{ width: '11px' }}
            >
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar
              orientation="horizontal"
              data-testid="scrollbar-horizontal"
              style={{ height: '13px' }}
            >
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner data-testid="corner" />
          </ScrollArea.Root>
        );

        const { rerender } = await render(renderArea(VIEWPORT_SIZE / 2));

        notifyResizeObserver();
        await flushMicrotasks();

        expect(screen.queryByTestId('corner')).toBe(null);

        await rerender(renderArea(SCROLLABLE_CONTENT_SIZE));

        notifyResizeObserver();
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('corner').style.width).toBe('11px');
        });
        await waitFor(() => {
          expect(screen.getByTestId('corner').style.height).toBe('13px');
        });
      });
    });

    it('clears corner, overflow attributes, and metrics when content stops overflowing', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        const contentSize = shallowRef(SCROLLABLE_CONTENT_SIZE);
        const App = defineComponent(() => () => (
          <>
            <button
              type="button"
              onClick={() => {
                contentSize.value = VIEWPORT_SIZE / 2;
              }}
            >
              shrink
            </button>
            <ScrollArea.Root
              data-testid="root"
              style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
            >
              <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
                <div
                  style={{ width: `${contentSize.value}px`, height: `${contentSize.value}px` }}
                />
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                orientation="vertical"
                keepMounted
                style={{ width: `${SCROLLBAR_WIDTH}px` }}
              >
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
              <ScrollArea.Scrollbar
                orientation="horizontal"
                keepMounted
                style={{ height: `${SCROLLBAR_HEIGHT}px` }}
              >
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
              <ScrollArea.Corner data-testid="corner" />
            </ScrollArea.Root>
          </>
        ));

        const { user } = await render(<App />);
        const root = screen.getByTestId('root');
        const viewport = screen.getByTestId('viewport');

        await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
        await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));
        expect(screen.getByTestId('corner')).toBeInTheDocument();
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-x-end')).not.toBe('0px');
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).not.toBe('0px');

        await user.click(screen.getByRole('button', { name: 'shrink' }));
        notifyResizeObserver();
        await flushMicrotasks();

        expect(root).not.toHaveAttribute('data-has-overflow-x');
        expect(root).not.toHaveAttribute('data-has-overflow-y');
        expect(screen.queryByTestId('corner')).toBe(null);
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-x-start')).toBe('0px');
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-x-end')).toBe('0px');
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-start')).toBe('0px');
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
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

    it('measures content mounted after the viewport initial measurement', async () => {
      const show = shallowRef(false);
      const App = defineComponent(() => () => (
        <ScrollArea.Root
          data-testid="root"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            {show.value && (
              <ScrollArea.Content>
                <div
                  style={{
                    width: `${SCROLLABLE_CONTENT_SIZE}px`,
                    height: `${SCROLLABLE_CONTENT_SIZE}px`,
                  }}
                />
              </ScrollArea.Content>
            )}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <button
            type="button"
            onClick={() => {
              show.value = true;
            }}
          >
            show
          </button>
        </ScrollArea.Root>
      ));

      await render(<App />);

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      // The first measurement writes this variable.
      await waitFor(() => {
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
      });
      // Wait for the first notification of the observer of the viewport. It comes after the
      // animation frame callbacks of the next frame. If the content mounts before it, that
      // observer measures again, and the case does not test the observer of the content.
      await waitSingleFrame();
      await waitSingleFrame();
      // Empty viewport: no overflow and kept out of tab order.
      expect(root).not.toHaveAttribute('data-has-overflow-y');
      expect(viewport).toHaveAttribute('tabindex', '-1');

      await fireEvent.click(screen.getByText('show'));

      // Once oversized content mounts, overflow state and tab order must update.
      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));
      await waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
    });

    it('applies data attributes on root, viewport and scrollbars based on overflow and edges', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');
      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      // Initial: at start (top/left)
      const allAttributes = [
        'data-has-overflow-x',
        'data-has-overflow-y',
        'data-overflow-x-start',
        'data-overflow-x-end',
        'data-overflow-y-start',
        'data-overflow-y-end',
      ];
      const atStart = {
        'data-has-overflow-x': true,
        'data-has-overflow-y': true,
        'data-overflow-x-start': false,
        'data-overflow-x-end': true,
        'data-overflow-y-start': false,
        'data-overflow-y-end': true,
      };

      await waitFor(() => {
        expect({
          root: getAttributeFlags(root, allAttributes),
          viewport: getAttributeFlags(viewport, allAttributes),
          content: getAttributeFlags(content, allAttributes),
          vScrollbar: getAttributeFlags(vScrollbar, [
            'data-has-overflow-y',
            'data-overflow-y-start',
            'data-overflow-y-end',
          ]),
          hScrollbar: getAttributeFlags(hScrollbar, [
            'data-has-overflow-x',
            'data-overflow-x-start',
            'data-overflow-x-end',
          ]),
        }).toEqual({
          root: atStart,
          viewport: atStart,
          content: atStart,
          vScrollbar: {
            'data-has-overflow-y': true,
            'data-overflow-y-start': false,
            'data-overflow-y-end': true,
          },
          hScrollbar: {
            'data-has-overflow-x': true,
            'data-overflow-x-start': false,
            'data-overflow-x-end': true,
          },
        });
      });

      // Scroll to middle
      const halfY = (viewport.scrollHeight - viewport.clientHeight) / 2;
      const halfX = (viewport.scrollWidth - viewport.clientWidth) / 2;
      await fireEvent.scroll(viewport, {
        target: { scrollTop: halfY, scrollLeft: halfX },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).toHaveAttribute('data-overflow-y-end');
      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-x-end');
      expect(content).toHaveAttribute('data-overflow-y-start');
      expect(content).toHaveAttribute('data-overflow-y-end');
      expect(content).toHaveAttribute('data-overflow-x-start');
      expect(content).toHaveAttribute('data-overflow-x-end');

      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-end');

      // Scroll to end
      await fireEvent.scroll(viewport, {
        target: {
          scrollTop: viewport.scrollHeight - viewport.clientHeight,
          scrollLeft: viewport.scrollWidth - viewport.clientWidth,
        },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');

      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(content).toHaveAttribute('data-overflow-y-start');
      expect(content).not.toHaveAttribute('data-overflow-y-end');
      expect(content).toHaveAttribute('data-overflow-x-start');
      expect(content).not.toHaveAttribute('data-overflow-x-end');

      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-end');
    });

    it('treats near-edge scroll offsets as fully scrolled', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

      await fireEvent.scroll(viewport, {
        target: {
          scrollTop: maxScrollTop - 0.5,
          scrollLeft: maxScrollLeft - 0.5,
        },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });

    it('respects overflowEdgeThreshold and exposes scroll metrics', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={{ xStart: 20, yStart: 5 }}
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await fireEvent.scroll(viewport, {
        target: { scrollLeft: 15, scrollTop: 7 },
      });

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-y-start');

      await fireEvent.scroll(viewport, {
        target: { scrollLeft: 35, scrollTop: 7 },
      });

      await waitFor(() => expect(viewport).toHaveAttribute('data-overflow-x-start'));

      const viewportStyle = viewport.style;
      const startPx = viewportStyle.getPropertyValue('--scroll-area-overflow-x-start');
      expect(startPx).toBe('35px');

      const horizontalEndPx = viewportStyle.getPropertyValue('--scroll-area-overflow-x-end');
      expect(horizontalEndPx).not.toBe('');
      expect(horizontalEndPx).not.toBe('0px');
    });

    it('applies numeric overflowEdgeThreshold to every edge', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={20}
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content>
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-x'));

      await fireEvent.scroll(viewport, {
        target: { scrollLeft: 15, scrollTop: 15 },
      });

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
      expect(viewport).toHaveAttribute('data-overflow-x-end');
      expect(viewport).toHaveAttribute('data-overflow-y-end');

      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: viewport.scrollWidth - viewport.clientWidth - 15,
          scrollTop: viewport.scrollHeight - viewport.clientHeight - 15,
        },
      });

      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
    });

    it('recomputes overflow edges when overflowEdgeThreshold changes', async () => {
      const renderArea = (yStart: number) => (
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={{ yStart }}
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content>
              <div
                style={{
                  width: `${SCROLLABLE_CONTENT_SIZE}px`,
                  height: `${SCROLLABLE_CONTENT_SIZE}px`,
                }}
              />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      );

      const { rerender } = await render(renderArea(5));

      const viewport = screen.getByTestId('viewport');

      await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
      await waitFor(() => expect(viewport).toHaveAttribute('data-overflow-y-start'));

      // Raising the threshold above the current offset must clear the edge without a new scroll.
      await rerender(renderArea(20));
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
    });

    it('does not add state attributes when content does not overflow', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div style={{ width: `${VIEWPORT_SIZE / 2}px`, height: `${VIEWPORT_SIZE / 2}px` }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            keepMounted
            data-testid="scrollbar-horizontal"
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');
      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      // The first measurement writes this variable.
      await waitFor(() => {
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
      });

      expect(root).not.toHaveAttribute('data-has-overflow-x');
      expect(root).not.toHaveAttribute('data-has-overflow-y');
      expect(root).not.toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
      expect(root).not.toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
      expect(content).not.toHaveAttribute('data-overflow-x-start');
      expect(content).not.toHaveAttribute('data-overflow-x-end');
      expect(content).not.toHaveAttribute('data-overflow-y-start');
      expect(content).not.toHaveAttribute('data-overflow-y-end');

      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-end');
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

  describe.skipIf(isJSDOM)('context stability', () => {
    it('does not re-render parts on scroll when the corner size is unchanged', async () => {
      let updateCount = 0;
      // The render function reads each ref of the context, so the probe renders again when one of
      // them changes.
      const ContextProbe = defineComponent(() => {
        const context = useScrollAreaRootContext();
        onUpdated(() => {
          updateCount += 1;
        });
        return () => {
          Object.values(context)
            .filter(isRef)
            .forEach((field) => field.value);
          return null;
        };
      });

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
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: '10px' }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" style={{ height: '10px' }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner data-testid="corner" />
          <ContextProbe />
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      // Wait until both scrollbars are visible and the corner has been measured,
      // which is the precondition for the corner-size setter to run on scroll.
      await waitFor(() => expect(screen.getByTestId('corner').style.width).toBe('10px'));
      await flushMicrotasks();

      const countBeforeScroll = updateCount;

      // Scrolling does not change the corner size, so no scroll-area part should re-render.
      // No task ends between the three awaits, so no observer delivery comes between them.
      for (let i = 0; i < 3; i += 1) {
        await fireEvent.scroll(viewport, { target: { scrollTop: 0, scrollLeft: 0 } });
      }

      expect(updateCount).toBe(countBeforeScroll);
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
