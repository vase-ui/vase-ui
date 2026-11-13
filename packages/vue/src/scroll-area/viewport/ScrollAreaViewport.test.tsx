import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, createSSRApp, defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import type { CDPSession } from '@vitest/browser-playwright';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import { ownerDocument } from '../../common/owner';
import { platform } from '../../common/platform';
import { SCROLL_TIMEOUT } from '../constants';
import ScrollAreaViewportHydration from './ScrollAreaViewportHydration.test.vue';

// `data-id` holds an id that Vue generates, so it can differ between two apps.
function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter(({ name }) => name !== 'data-id')
      .map(({ name, value }) => [name, name === 'style' ? element.style.cssText : value]),
  );
}

describe('<ScrollArea.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<ScrollArea.Root>{node}</ScrollArea.Root>);
    },
  }));

  it('does not use a presentational role on the focusable viewport', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport tabindex={0} data-testid="viewport" />
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');

    expect(viewport).not.toHaveAttribute('role', 'presentation');
    expect(viewport).toHaveAttribute('tabindex', '0');
  });

  it('handles a user scroll callback unmounting the viewport', async () => {
    // `unmount()` unmounts at once. A state write unmounts in the next flush, after the listener
    // of the part. Such a test could not fail when the part reads a viewport that is gone.
    const view: VaseUIRenderResult = await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" onScroll={() => view.unmount()} />
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');

    // A pointer move marks the next scroll as a user scroll. The listener of the part then goes on
    // to read the viewport.
    await fireEvent.pointerMove(viewport);
    await fireEvent.scroll(viewport);

    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  describe.skipIf(isJSDOM)('subtree animations', () => {
    afterEach(() => vi.restoreAllMocks());

    it.skipIf(!platform.engine.blink)(
      'releases a completed animation target while another animation is paused',
      async () => {
        const { cdp } = await import('vitest/browser');
        const session = cdp() as CDPSession;
        let targetRef: WeakRef<HTMLDivElement> | undefined;
        let animationsRead = false;

        // Vue drops a ref on a vnode that the body of the test makes. The ref is therefore in a
        // render function.
        await render(() => (
          <ScrollArea.Root>
            <ScrollArea.Viewport
              data-testid="viewport"
              ref={(component) => {
                const node = (component as { element: HTMLElement | null } | null)?.element;
                if (!node || node.firstElementChild) {
                  return;
                }

                const target = ownerDocument(node).createElement('div');
                const pausedTarget = ownerDocument(node).createElement('div');
                node.append(target, pausedTarget);
                targetRef = new WeakRef(target);

                for (const element of [target, pausedTarget]) {
                  element
                    .animate({ opacity: [0, 1] }, { duration: 1000, fill: 'forwards' })
                    .pause();
                }

                // A spy would retain the Animation objects in its recorded results.
                const getAnimations = node.getAnimations.bind(node);
                node.getAnimations = (options) => {
                  animationsRead = true;
                  return getAnimations(options);
                };
              }}
            />
          </ScrollArea.Root>
        ));

        await waitFor(() => expect(animationsRead).toBe(true));

        const viewport = screen.getByTestId('viewport');
        viewport.firstElementChild!.getAnimations()[0].finish();
        await flushMicrotasks();
        viewport.firstElementChild!.remove();
        await waitSingleFrame();

        await session.send('HeapProfiler.collectGarbage');

        expect(targetRef!.deref()).toBeUndefined();
        expect(viewport.firstElementChild!.getAnimations()[0].playState).toBe('paused');
      },
    );

    it.each([
      ['no infinite animation', undefined],
      ['infinite iterations', { iterations: Infinity }],
      ['infinite duration', { duration: Infinity, iterations: 1 }],
    ] as const)(
      'recomputes overflow after a subtree animation finishes with %s',
      async (_description, infiniteTiming) => {
        vi.spyOn(ResizeObserver.prototype, 'observe').mockImplementation(() => {});
        let scrollWidth = 100;
        let resolveAnimation: () => void = () => {};
        const finished = new Promise<void>((resolve) => {
          resolveAnimation = resolve;
        });
        const getAnimations = vi.fn(
          () =>
            [
              { finished },
              ...(infiniteTiming
                ? [
                    {
                      finished: new Promise<void>(() => {}),
                      effect: { getTiming: () => infiniteTiming },
                    },
                  ]
                : []),
            ] as unknown as Animation[],
        );

        // Vue drops a ref on a vnode that the body of the test makes. The ref is therefore in a
        // render function.
        await render(() => (
          <ScrollArea.Root data-testid="root">
            <ScrollArea.Viewport
              ref={(component) => {
                const node = (component as { element: HTMLElement | null } | null)?.element;
                if (node) {
                  Object.defineProperties(node, {
                    clientHeight: { configurable: true, value: 100 },
                    clientWidth: { configurable: true, value: 100 },
                    scrollHeight: { configurable: true, value: 100 },
                    scrollWidth: { configurable: true, get: () => scrollWidth },
                    getAnimations: { configurable: true, value: getAnimations },
                  });
                }
              }}
            />
            <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        ));

        const root = screen.getByTestId('root');
        await waitFor(() => expect(getAnimations).toHaveBeenCalled());
        expect(root).not.toHaveAttribute('data-has-overflow-x');

        scrollWidth = 1000;
        resolveAnimation();
        await finished;
        await flushMicrotasks();

        await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      },
    );

    it('ignores an animation finishing after its viewport unmounts', async () => {
      let resolveAnimation: () => void = () => {};
      const finished = new Promise<void>((resolve) => {
        resolveAnimation = resolve;
      });
      const getAnimations = vi.fn(() => [{ finished }] as unknown as Animation[]);

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              unmount
            </button>
            <ScrollArea.Root>
              {mounted.value && (
                <ScrollArea.Viewport
                  data-testid="viewport"
                  ref={(component) => {
                    const node = (component as { element: HTMLElement | null } | null)?.element;
                    if (node) {
                      Object.defineProperty(node, 'getAnimations', {
                        configurable: true,
                        value: getAnimations,
                      });
                    }
                  }}
                />
              )}
            </ScrollArea.Root>
          </>
        );
      });

      const { user } = await render(<App />);
      await waitFor(() => expect(getAnimations).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'unmount' }));
      expect(screen.queryByTestId('viewport')).toBe(null);

      resolveAnimation();
      await finished;
      await flushMicrotasks();
    });
  });

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
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      expect(viewport).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('ignores data-scrolling during programmatic scroll', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      // No user interaction before the scroll event, as with `scrollTo()`.
      // `pointer-events: none` isolates this from the browser's real pointer.
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('adds [data-scrolling] in touch modality even when the gesture delivers no events', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      // The initial touch is delivered normally and establishes touch modality.
      await fireEvent.pointerDown(viewport, { pointerType: 'touch' });

      // A touch that catches an in-flight momentum scroll or rubber-band
      // bounce is consumed natively by WebKit: no touch/pointer events fire
      // for the whole gesture, only scroll events after an arbitrary pause.
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('keeps ignoring programmatic scrolls in mouse modality', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await fireEvent.pointerDown(viewport, { pointerType: 'mouse' });

      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('restores programmatic scroll suppression after modality flips back to mouse', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          {/* `pointer-events: none` isolates this from the browser's real pointer. A real
              pointer that enters the viewport makes the next scroll a user scroll. */}
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      await fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // A mouse pointermove on the root (not the viewport, whose own
      // handlers mark user interaction) switches back to mouse modality.
      await fireEvent.pointerMove(root, { pointerType: 'mouse' });
      await fireEvent.scroll(viewport, { target: { scrollTop: 2 } });

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('removes [data-scrolling] after timeout', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      // Start scrolling
      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait less than timeout - should still be scrolling
      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT - 1);
      await flushMicrotasks();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait for remaining timeout
      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('ends the user scroll after 100 ms with no scroll event', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      // The times are in ms from the first scroll.
      let elapsed = 0;
      async function advanceTo(time: number) {
        await vi.advanceTimersByTimeAsync(time - elapsed);
        await flushMicrotasks();
        elapsed = time;
      }

      // The viewport tells the root about user scrolls only. The root removes `data-scrolling`
      // 500 ms after the last user scroll.
      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // A scroll less than 100 ms after another scroll is still a user scroll.
      await advanceTo(99);
      await fireEvent.scroll(viewport, { target: { scrollTop: 2 } });
      await advanceTo(198);
      await fireEvent.scroll(viewport, { target: { scrollTop: 3 } });

      // A scroll 100 ms after another scroll is a programmatic scroll.
      await advanceTo(298);
      await fireEvent.scroll(viewport, { target: { scrollTop: 4 } });

      // The last user scroll is the third scroll.
      await advanceTo(198 + SCROLL_TIMEOUT - 1);

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await advanceTo(198 + SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });
  });

  describe.skipIf(isJSDOM)('overflow data attributes (viewport)', () => {
    const VIEWPORT_SIZE = 200;
    const SCROLLABLE_CONTENT_SIZE = 1000;

    it('applies data attributes on viewport', async () => {
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
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await waitFor(() => {
        expect({
          hasOverflowX: viewport.hasAttribute('data-has-overflow-x'),
          hasOverflowY: viewport.hasAttribute('data-has-overflow-y'),
          overflowXStart: viewport.hasAttribute('data-overflow-x-start'),
          overflowXEnd: viewport.hasAttribute('data-overflow-x-end'),
          overflowYStart: viewport.hasAttribute('data-overflow-y-start'),
          overflowYEnd: viewport.hasAttribute('data-overflow-y-end'),
        }).toEqual({
          hasOverflowX: true,
          hasOverflowY: true,
          overflowXStart: false,
          overflowXEnd: true,
          overflowYStart: false,
          overflowYEnd: true,
        });
      });
    });
  });

  // Only Safari reports an out-of-range `scrollTop`/`scrollLeft` while rubber-banding, and the
  // browser clamps the property on assignment, so the getter is mocked to emulate it against
  // real layout.
  describe.skipIf(isJSDOM)('overscroll feedback', () => {
    const VIEWPORT_SIZE = 200;
    const CONTENT_SIZE = 1000;
    const MAX_SCROLL = CONTENT_SIZE - VIEWPORT_SIZE;

    async function renderScrollArea(
      orientation: 'vertical' | 'horizontal',
      textDirection: 'ltr' | 'rtl' = 'ltr',
    ) {
      await render(
        <DirectionProvider direction={textDirection}>
          <ScrollArea.Root
            style={{
              width: `${VIEWPORT_SIZE}px`,
              height: `${VIEWPORT_SIZE}px`,
              direction: textDirection,
            }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div
                style={{
                  width: orientation === 'horizontal' ? `${CONTENT_SIZE}px` : '100%',
                  height: orientation === 'vertical' ? `${CONTENT_SIZE}px` : '100%',
                }}
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted>
              <ScrollArea.Thumb data-testid="thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      const axis = orientation === 'vertical' ? 'height' : 'width';
      await waitFor(() => expect(thumb.getBoundingClientRect()[axis]).toBeGreaterThan(0));

      return { viewport, scrollbar, thumb };
    }

    async function overscroll(
      viewport: HTMLDivElement,
      prop: 'scrollTop' | 'scrollLeft',
      value: number,
    ) {
      Object.defineProperty(viewport, prop, { configurable: true, get: () => value });
      await fireEvent.scroll(viewport);
    }

    it('shrinks and pins the thumb to the start edge while overscrolling past the top', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      await overscroll(viewport, 'scrollTop', -50);

      // Shrinks, but damped by the content length rather than subtracting the raw pixels
      // (a 1:1 subtraction of 50px would collapse this thumb to its minimum size).
      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));
      expect(thumb.getBoundingClientRect().height).toBeGreaterThan(restingHeight * 0.9);
      // Pinned to the top edge of the track.
      expect(thumb.getBoundingClientRect().top).toBeCloseTo(
        scrollbar.getBoundingClientRect().top,
        0,
      );
    });

    it('shrinks and pins the thumb to the end edge while overscrolling past the bottom', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      await overscroll(viewport, 'scrollTop', MAX_SCROLL + 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));
      expect(thumb.getBoundingClientRect().height).toBeGreaterThan(restingHeight * 0.9);
      // Pinned to the bottom edge of the track.
      expect(thumb.getBoundingClientRect().bottom).toBeCloseTo(
        scrollbar.getBoundingClientRect().bottom,
        0,
      );
    });

    it('restores the resting thumb size once the viewport settles back into range', async () => {
      const { viewport, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      await overscroll(viewport, 'scrollTop', -50);
      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));

      await overscroll(viewport, 'scrollTop', 100);
      await waitFor(() =>
        expect(thumb.getBoundingClientRect().height).toBeCloseTo(restingHeight, 0),
      );
    });

    it('shrinks and pins the horizontal thumb to the inline start while overscrolling (LTR)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal');

      const restingWidth = thumb.getBoundingClientRect().width;

      await overscroll(viewport, 'scrollLeft', -50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline start is the left edge in LTR.
      expect(thumb.getBoundingClientRect().left).toBeCloseTo(
        scrollbar.getBoundingClientRect().left,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline end while overscrolling (LTR)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal');

      const restingWidth = thumb.getBoundingClientRect().width;

      await overscroll(viewport, 'scrollLeft', MAX_SCROLL + 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline end is the right edge in LTR.
      expect(thumb.getBoundingClientRect().right).toBeCloseTo(
        scrollbar.getBoundingClientRect().right,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline start while overscrolling (RTL)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal', 'rtl');

      const restingWidth = thumb.getBoundingClientRect().width;

      // RTL scrolls from 0 toward `-MAX_SCROLL`; overscrolling the inline start goes positive.
      await overscroll(viewport, 'scrollLeft', 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline start is the right edge in RTL.
      expect(thumb.getBoundingClientRect().right).toBeCloseTo(
        scrollbar.getBoundingClientRect().right,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline end while overscrolling (RTL)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal', 'rtl');

      const restingWidth = thumb.getBoundingClientRect().width;

      // RTL overscroll past the inline end goes beyond `-MAX_SCROLL`.
      await overscroll(viewport, 'scrollLeft', -(MAX_SCROLL + 50));

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline end is the left edge in RTL.
      expect(thumb.getBoundingClientRect().left).toBeCloseTo(
        scrollbar.getBoundingClientRect().left,
        0,
      );
    });
  });

  describe('ResizeObserver', () => {
    it('recomputes the overflow attributes when the viewport changes size', async () => {
      const { setProps } = await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '150px', height: '150px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await waitFor(() => {
        expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
      });
      expect(viewport).not.toHaveAttribute('data-has-overflow-y');

      await setProps({ style: { width: '100px', height: '100px' } });

      await waitFor(() => {
        expect(viewport).toHaveAttribute('data-has-overflow-y');
      });

      // The assertion above passes in the microtasks of the delivery of the observer. A test that
      // ends there makes the next test with an observer get a loop error from the browser.
      await waitSingleFrame();
    });

    it('stops the observer when the viewport unmounts', async () => {
      const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      onTestFinished(() => {
        disconnect.mockRestore();
      });

      const { unmount } = await render(
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>,
      );

      expect(disconnect).not.toHaveBeenCalled();

      unmount();

      expect(disconnect).toHaveBeenCalledTimes(1);
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

    it('releases the observer and the timers on deactivation, and takes them back on activation', async () => {
      const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
      const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      onTestFinished(() => {
        observe.mockRestore();
        disconnect.mockRestore();
      });

      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
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
      const viewport = screen.getByTestId('viewport');
      // The count after the mount holds the animation wait timer of the viewport. It can also hold
      // a timer of Vue: the first app of a page starts one in a development build. So the test
      // compares counts. The scroll adds the scroll end timer. The deactivation must remove the
      // two timers of the viewport. The activation must start the animation wait timer again.
      const timersAfterMount = vi.getTimerCount();

      await fireEvent.scroll(viewport, { target: { scrollTop: 100 } });

      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(observe).toHaveBeenCalledTimes(1);
      expect(disconnect).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      // The pointer move makes the next scroll a user scroll. The deactivation must end that state,
      // as the scroll end timer does.
      await fireEvent.pointerMove(viewport);
      visible.value = false;
      await nextTick();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(timersAfterMount - 1);

      visible.value = true;
      await nextTick();
      // The measurement of the activation is a microtask. Its state change needs a second flush.
      await nextTick();

      expect(observe).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(timersAfterMount);
      // The browser reset the scroll position while the element was out of the document.
      expect(viewport.scrollTop).toBe(0);
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');

      await fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('reads the hover state again on activation', async () => {
      const visible = shallowRef(true);
      // `pointer-events: none` isolates this from the browser's real pointer.
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <ScrollArea.Root style={{ width: '200px', height: '200px', pointerEvents: 'none' }}>
              <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
                <div style={{ width: '1000px', height: '1000px' }} />
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
            </ScrollArea.Root>
          ) : null}
        </KeepAlive>
      ));

      await renderWithFakeTimers(<App />);
      const scrollbar = screen.getByTestId('scrollbar');

      expect(scrollbar).not.toHaveAttribute('data-hovering');

      visible.value = false;
      await nextTick();

      // A pointer that is over a viewport that comes back sends no enter event.
      const originalMatches = Element.prototype.matches;
      const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function matches(
        this: Element,
        selector: string,
      ) {
        if (selector === ':hover' && (this as HTMLElement).dataset.testid === 'viewport') {
          return true;
        }
        return originalMatches.call(this, selector);
      });
      onTestFinished(() => {
        matchesSpy.mockRestore();
      });

      visible.value = true;
      await nextTick();

      expect(scrollbar).toHaveAttribute('data-hovering');
    });
  });

  describe('hydration', () => {
    it('hydrates the viewport, then takes it into the tab order after the measurement', async () => {
      // The `hydrate` helper compares after two ticks. The `tabindex` changes after the
      // measurement, so the test hydrates by hand and waits for the attribute.
      const serverHtml = await renderOnServer(
        'src/scroll-area/viewport/ScrollAreaViewportHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const viewport = within(container).getByTestId('viewport');
      expect(viewport).toHaveAttribute('tabindex', '-1');

      const hydratingApp = createSSRApp(ScrollAreaViewportHydration);
      onTestFinished(() => {
        hydratingApp.unmount();
        container.remove();
      });
      hydratingApp.mount(container);

      await waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('viewport')).toBe(viewport);
      expect(takeReportedMessages()).toEqual([]);

      const clientContainer = document.createElement('div');
      document.body.append(clientContainer);
      const clientApp = createApp(ScrollAreaViewportHydration);
      onTestFinished(() => {
        clientApp.unmount();
        clientContainer.remove();
      });
      clientApp.mount(clientContainer);
      const clientViewport = within(clientContainer).getByTestId('viewport');

      await waitFor(() => expect(clientViewport).toHaveAttribute('tabindex', '0'));

      expect(readAttributes(viewport)).toEqual(readAttributes(clientViewport));
    });
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Root>', async () => {
    await expect(render(<ScrollArea.Viewport />)).rejects.toThrow(
      'Vase UI: A part of Scroll Area must be inside <ScrollArea.Root>. Without a root the part has no scroll state to read. Put the part inside <ScrollArea.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
