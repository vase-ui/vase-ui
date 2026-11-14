import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, defineComponent, Fragment, shallowRef } from 'vue';
import type { CSSProperties, PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  isJSDOM,
  screen,
} from '#test-utils';
import { useSwipeDismiss } from './useSwipeDismiss';
import type { SwipeDirection, UseSwipeDismissReturnValue } from './useSwipeDismiss';

const SwipeBox = defineComponent(() => {
  const ref = shallowRef<HTMLDivElement | null>(null);
  const swipe = useSwipeDismiss({
    enabled: true,
    directions: ['down'],
    elementRef: ref,
    movementCssVars: { x: '--x', y: '--y' },
  });

  return () => (
    <div data-testid="el" ref={ref} style={swipe.getDragStyles()} {...swipe.pointerProps} />
  );
});

const SwipeProgressBox = defineComponent(
  (props: { onProgress: (progress: number) => void }) => {
    const ref = shallowRef<HTMLDivElement | null>(null);
    const swipe = useSwipeDismiss({
      enabled: true,
      directions: ['right'],
      elementRef: ref,
      movementCssVars: { x: '--x', y: '--y' },
      onProgress: (progress) => props.onProgress(progress),
    });

    return () => (
      <div data-testid="progress" ref={ref} style={swipe.getDragStyles()} {...swipe.pointerProps} />
    );
  },
  { props: ['onProgress'] },
);

describe('useSwipeDismiss', () => {
  const { render } = createRenderer();

  it('does not start swiping within a scrollable element when ignoreScrollableAncestors is true', async () => {
    const onSwipeStart = vi.fn();

    const SwipeBoxScrollable = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipeDismiss = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        ignoreScrollableAncestors: true,
        onSwipeStart,
      });

      return () => (
        <div
          data-testid="root"
          ref={ref}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.pointerProps}
        >
          <div data-testid="scroll" style={{ overflowY: 'auto', height: '100px' }}>
            <div style={{ height: '200px' }} />
          </div>
        </div>
      );
    });

    await render(<SwipeBoxScrollable />);

    const root = screen.getByTestId('root');
    const scroll = screen.getByTestId('scroll') as HTMLDivElement;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    if (scroll.scrollHeight <= scroll.clientHeight) {
      const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
      if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'scrollHeight', { value: 200, configurable: true });
      }

      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
      if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });
      }
    }

    try {
      await fireEvent.pointerDown(scroll, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
      });

      await flushMicrotasks();

      await fireEvent.pointerMove(scroll, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 150,
        bubbles: true,
        movementX: 0,
        movementY: 50,
      });

      await flushMicrotasks();

      expect(onSwipeStart).not.toHaveBeenCalled();
      expect(root.style.getPropertyValue('--y')).toBe('0px');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it.skipIf(isJSDOM)('starts a touch swipe when the page scroller is `body`', async () => {
    const onSwipeStart = vi.fn();

    const SwipeBoxFixed = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });

      return () => (
        <div
          data-testid="el"
          ref={ref}
          style={{ ...swipe.getDragStyles(), position: 'fixed', inset: 0 }}
          {...swipe.touchProps}
        />
      );
    });

    const { body } = document;
    const html = document.documentElement;
    const previousBodyStyle = body.style.cssText;
    const previousHtmlStyle = html.style.cssText;
    // A reset that turns `body` into a real scroll container instead of letting its overflow
    // propagate to the viewport.
    html.style.cssText = 'height: 100%; overflow-y: auto';
    body.style.cssText = 'height: 100%; overflow-y: auto';

    try {
      await render(
        <Fragment>
          <div style={{ height: '5000px' }} />
          <SwipeBoxFixed />
        </Fragment>,
      );

      // Being at the start edge is what made the upward move fail: it can only pass the
      // scroll-edge gate when the container is scrolled to the end.
      expect(body.scrollTop).toBe(0);
      expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

      const element = screen.getByTestId('el');
      await fireTouch.start(element, {
        touches: [{ clientX: 50, clientY: 300 }],
      });
      await fireTouch.move(element, {
        touches: [{ clientX: 50, clientY: 260 }],
      });

      expect(onSwipeStart).toHaveBeenCalledTimes(1);
    } finally {
      body.style.cssText = previousBodyStyle;
      html.style.cssText = previousHtmlStyle;
    }
  });

  it.skipIf(isJSDOM)(
    'keeps gating on a scrollable descendant of the other axis when `body` scrolls the page',
    async () => {
      const onSwipeStart = vi.fn();

      const SwipeBoxCrossAxis = defineComponent(() => {
        const ref = shallowRef<HTMLDivElement | null>(null);
        const swipe = useSwipeDismiss({
          enabled: true,
          directions: ['right'],
          elementRef: ref,
          movementCssVars: { x: '--x', y: '--y' },
          onSwipeStart,
        });

        return () => (
          <div
            data-testid="el"
            ref={ref}
            style={{ ...swipe.getDragStyles(), position: 'fixed', inset: 0 }}
            {...swipe.touchProps}
          >
            <div
              data-testid="scroll"
              style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', height: '100%' }}
            >
              <div style={{ width: '5000px', height: '20px' }} />
            </div>
          </div>
        );
      });

      const { body } = document;
      const html = document.documentElement;
      const previousBodyStyle = body.style.cssText;
      const previousHtmlStyle = html.style.cssText;
      html.style.cssText = 'height: 100%; overflow-y: auto';
      body.style.cssText = 'height: 100%; overflow-y: auto';

      try {
        await render(
          <Fragment>
            <div style={{ height: '5000px' }} />
            <SwipeBoxCrossAxis />
          </Fragment>,
        );

        const scroll = screen.getByTestId('scroll');
        // Away from the start edge, so the horizontal scroller must refuse the rightward swipe.
        scroll.scrollLeft = 20;

        expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
        expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
        expect(scroll.scrollLeft).toBeGreaterThan(0);

        await fireTouch.start(scroll, {
          touches: [{ clientX: 50, clientY: 300 }],
        });
        await fireTouch.move(scroll, {
          touches: [{ clientX: 90, clientY: 300 }],
        });

        expect(onSwipeStart).not.toHaveBeenCalled();
      } finally {
        body.style.cssText = previousBodyStyle;
        html.style.cssText = previousHtmlStyle;
      }
    },
  );

  it('does not prevent touch scrolling during swipe interactions', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // First move establishes the baseline (iOS pointermove delay handling).
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Move up (unsupported) should not block the default touch scroll behavior.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 50,
      bubbles: true,
      movementX: 0,
      movementY: -50,
    });

    await flushMicrotasks();

    const touchMoveBefore = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveBefore);
    expect(touchMoveBefore.defaultPrevented).toBe(false);

    // Once a supported direction is detected, touchmove should still not be prevented.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 150,
      bubbles: true,
      movementX: 0,
      movementY: 100,
    });

    await flushMicrotasks();

    const touchMoveAfter = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveAfter);
    expect(touchMoveAfter.defaultPrevented).toBe(false);
  });

  it('fires onProgress relative to the element size', async () => {
    const onProgress = vi.fn();
    await render(<SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
    }

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 50,
      clientY: 0,
      bubbles: true,
      movementX: 50,
      movementY: 0,
    });

    await flushMicrotasks();

    const progress = onProgress.mock.calls.at(-1)?.[0];
    expect(progress).toBeCloseTo(0.25, 2);
  });

  it('continues firing onProgress when swipe progress is clamped', async () => {
    const onProgress = vi.fn();
    await render(<SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
    }

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Baseline move.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 50,
      clientY: 0,
      bubbles: true,
      movementX: 50,
      movementY: 0,
    });

    await flushMicrotasks();

    const callsAfterForward = onProgress.mock.calls.length;

    // Move past the starting point in the opposite direction; progress is clamped to 0.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: -10,
      clientY: 0,
      bubbles: true,
      movementX: -60,
      movementY: 0,
    });

    await flushMicrotasks();

    const callsAfterReverse = onProgress.mock.calls.length;
    expect(callsAfterReverse).toBeGreaterThan(callsAfterForward);

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: -20,
      clientY: 0,
      bubbles: true,
      movementX: -10,
      movementY: 0,
    });

    await flushMicrotasks();

    expect(onProgress.mock.calls.length).toBeGreaterThan(callsAfterReverse);
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('applies exponential damping for opposite-direction movement', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();
    expect(element.style.transition).toBe('none');

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 50,
      bubbles: true,
      movementX: 0,
      movementY: -50,
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).not.toBe('0px');
  });

  it('preserves inline transform and transition when resetting drag styles', async () => {
    const SwipeBoxWithInlineStyles = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
      });

      return () => (
        <Fragment>
          <button type="button" onClick={swipe.reset}>
            Reset
          </button>
          <div
            data-testid="styled"
            ref={ref}
            style={{
              ...swipe.getDragStyles(),
              transform: 'scale(0.9)',
              transition: 'opacity 200ms ease',
            }}
            {...swipe.pointerProps}
          />
        </Fragment>
      );
    });

    await render(<SwipeBoxWithInlineStyles />);
    const element = screen.getByTestId('styled');
    const initialTransform = element.style.transform;
    const initialTransition = element.style.transition;

    async function moveTo(clientY: number, movementY: number) {
      await fireEvent.pointerMove(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY,
      });

      await flushMicrotasks();
    }

    expect(initialTransform).not.toBe('');
    expect(initialTransition).not.toBe('');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await moveTo(0, 0);
    await moveTo(12, 12);
    await moveTo(16, 4);

    await fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 16,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);
  });

  it('applies the drag transform imperatively while swiping', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // The first move only establishes the drag baseline.
    await fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 40,
    });

    await flushMicrotasks();

    expect(element.style.transition).toBe('none');
    expect(element.style.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);
    expect(element.style.getPropertyValue('--y')).toBe('40px');
  });

  it('keeps the drag transform on a render that lags behind the swiping state', async () => {
    let initialGetDragStyles: (() => CSSProperties) | undefined;

    const SwipeBoxCaptureStyles = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
      });

      // Keep the `getDragStyles` of a time when `swiping` is false. During the swipe, it must
      // still give the transform that the composable wrote to the element.
      if (!swipe.swiping.value) {
        initialGetDragStyles = swipe.getDragStyles;
      }

      return () => (
        <div data-testid="el" ref={ref} style={swipe.getDragStyles()} {...swipe.pointerProps} />
      );
    });

    await render(<SwipeBoxCaptureStyles />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // The first move only establishes the drag baseline.
    await fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 40,
    });

    await flushMicrotasks();

    // The swipe is active, and the composable wrote the transform to the element.
    expect(element.style.transition).toBe('none');

    // A render with these styles keeps `transition: 'none'` and the drag transform. Else the
    // element goes back to its rest transform during the swipe.
    expect(initialGetDragStyles).toBeDefined();
    const laggingStyles = initialGetDragStyles?.() ?? {};
    expect(laggingStyles.transition).toBe('none');
    expect(laggingStyles.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);
  });

  it('respects custom swipeThreshold', async () => {
    const onDismiss = vi.fn();

    const SwipeBoxThreshold = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        swipeThreshold: 10,
        onDismiss,
      });

      return () => (
        <div data-testid="el" ref={ref} style={swipe.getDragStyles()} {...swipe.pointerProps} />
      );
    });

    await render(<SwipeBoxThreshold />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Baseline move.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Move beyond the custom 10px threshold.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
      movementX: 0,
      movementY: 20,
    });

    await flushMicrotasks();

    await fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalled();
  });

  it('snapshots swipeThreshold for the active gesture (strict: %s)', async () => {
    const onDismiss = vi.fn();

    const SwipeBoxThreshold = defineComponent(
      (props: { swipeThreshold: number }) => {
        const ref = shallowRef<HTMLDivElement | null>(null);
        const swipe = useSwipeDismiss({
          enabled: true,
          directions: ['down'],
          elementRef: ref,
          movementCssVars: { x: '--x', y: '--y' },
          swipeThreshold: () => props.swipeThreshold,
          onDismiss,
        });

        return () => (
          <div data-testid="el" ref={ref} style={swipe.getDragStyles()} {...swipe.pointerProps} />
        );
      },
      { props: ['swipeThreshold'] },
    );

    const { setProps } = await render(<SwipeBoxThreshold swipeThreshold={50} />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    });

    await setProps({ swipeThreshold: 10 });

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });
    await fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    expect(onDismiss).not.toHaveBeenCalled();

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 2,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(element, {
      pointerId: 2,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    });
    await fireEvent.pointerMove(element, {
      pointerId: 2,
      buttons: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });
    await fireEvent.pointerUp(element, {
      pointerId: 2,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onSwipingChange on start and end', async () => {
    const onSwipingChange = vi.fn();

    const SwipeBoxSwipingChange = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return () => (
        <div
          data-testid="swiping"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    await render(<SwipeBoxSwipingChange />);
    const element = screen.getByTestId('swiping');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });

  it('cancels pointer swipe when the primary mouse button is released without pointerup', async () => {
    const onDismiss = vi.fn();
    const onSwipingChange = vi.fn();

    const SwipeBoxPointerCancel = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onSwipingChange,
      });

      return () => (
        <div
          data-testid="pointer-cancel"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    await render(<SwipeBoxPointerCancel />);
    const element = screen.getByTestId('pointer-cancel');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 12,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 12,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledWith(true);
    expect(element.style.getPropertyValue('--y')).not.toBe('0px');

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 16,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 4,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 24,
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('commits the swipe when the primary button is released past the threshold without pointerup', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();

    const SwipeBoxFlickRelease = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onCancel,
      });

      return () => (
        <div
          data-testid="flick-release"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    await render(<SwipeBoxFlickRelease />);
    const element = screen.getByTestId('flick-release');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // First move establishes the start position; the second provides the displacement.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // On a fast trackpad flick the click releases just before pointerup, producing a trailing
    // `buttons: 0` pointermove. It must commit the gesture (past the threshold here), not cancel it.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the final buttons:0 release move to decide dismissal when it crosses the threshold', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();

    const SwipeBoxReleaseMove = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onCancel,
      });

      return () => (
        <div
          data-testid="release-move"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    await render(<SwipeBoxReleaseMove />);
    const element = screen.getByTestId('release-move');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // Last pressed move stays just BELOW the 40px threshold.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 35,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // The trailing `buttons: 0` release move is the one that carries the threshold-crossing
    // displacement; it must be applied before the release is decided.
    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('resets swiping when touch ends over a scrollable descendant', async () => {
    const onSwipingChange = vi.fn();

    const SwipeBoxTouchScrollableEnd = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return () => (
        <div data-testid="touch-root" ref={ref} style={swipe.getDragStyles()} {...swipe.touchProps}>
          <div data-testid="touch-scroll" style={{ overflowY: 'auto', maxHeight: '40px' }}>
            <div style={{ height: '120px' }} />
          </div>
        </div>
      );
    });

    await render(<SwipeBoxTouchScrollableEnd />);

    const root = screen.getByTestId('touch-root');
    const scroll = screen.getByTestId('touch-scroll');

    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
    if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    }

    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
    if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    }

    await fireTouch.start(root, {
      touches: [
        {
          clientX: 0,
          clientY: 0,
        },
      ],
    });

    await flushMicrotasks();

    await fireTouch.move(root, {
      touches: [
        {
          clientX: 0,
          clientY: 20,
        },
      ],
    });

    await flushMicrotasks();

    await fireTouch.end(scroll, {
      changedTouches: [
        {
          clientX: 0,
          clientY: 20,
        },
      ],
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  it('allows onRelease to override dismissal', async () => {
    const onDismiss = vi.fn();
    const onRelease = vi.fn(() => false);

    const SwipeBoxReleaseOverride = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        swipeThreshold: 10,
        onDismiss,
        onRelease,
      });

      return () => (
        <div
          data-testid="release"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    await render(<SwipeBoxReleaseOverride />);
    const element = screen.getByTestId('release');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
      movementX: 0,
      movementY: 20,
    });

    await flushMicrotasks();

    await fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onRelease).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('provides swipe velocity on release', async () => {
    const onRelease = vi.fn();

    const SwipeBoxReleaseVelocity = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        movementX: 50,
        movementY: 0,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        timeStamp: 1300,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.25, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('provides release velocity from the latest swipe movement', async () => {
    const onRelease = vi.fn();

    const SwipeBoxReleaseVelocity = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-latest"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-latest');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        movementX: 50,
        movementY: 0,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 70,
        clientY: 0,
        bubbles: true,
        movementX: 20,
        movementY: 0,
        timeStamp: 1216,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 70,
        clientY: 0,
        bubbles: true,
        timeStamp: 1224,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityX).toBeCloseTo(1.25, 2);
      expect(details?.releaseVelocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { trailingTime: 1040, releaseTime: 1048, expectedVelocity: 2.5 },
    { trailingTime: 1040, releaseTime: 1113, expectedVelocity: 0 },
    { trailingTime: 1113, releaseTime: 1121, expectedVelocity: 0 },
  ])(
    'handles a stationary move at $trailingTime and release at $releaseTime',
    async ({ trailingTime, releaseTime, expectedVelocity }) => {
      const onRelease = vi.fn();

      const SwipeBoxTrailingSample = defineComponent(() => {
        const ref = shallowRef<HTMLDivElement | null>(null);
        const swipe = useSwipeDismiss({
          enabled: true,
          directions: ['down'],
          elementRef: ref,
          movementCssVars: { x: '--x', y: '--y' },
          onRelease,
        });

        return () => (
          <div
            data-testid="release-velocity-trailing-sample"
            ref={ref}
            style={swipe.getDragStyles()}
            {...swipe.pointerProps}
          />
        );
      });

      vi.useFakeTimers();
      try {
        await render(<SwipeBoxTrailingSample />);
        const element = screen.getByTestId('release-velocity-trailing-sample');

        await firePointer.down(element, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          bubbles: true,
          pointerType: 'mouse',
          movementX: 0,
          movementY: 0,
          timeStamp: 1000,
        });

        await flushMicrotasks();

        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 20,
          bubbles: true,
          movementX: 0,
          movementY: 20,
          timeStamp: 1008,
        });

        await flushMicrotasks();

        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 40,
          bubbles: true,
          movementX: 0,
          movementY: 20,
          timeStamp: 1016,
        });

        await flushMicrotasks();

        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 60,
          bubbles: true,
          movementX: 0,
          movementY: 20,
          timeStamp: 1024,
        });

        await flushMicrotasks();

        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 80,
          bubbles: true,
          movementX: 0,
          movementY: 20,
          timeStamp: 1032,
        });

        await flushMicrotasks();

        // Chrome on Android emits an effectively stationary sample right before `pointerup`.
        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 80.5,
          bubbles: true,
          movementX: 0,
          movementY: 0.5,
          timeStamp: trailingTime,
        });

        await flushMicrotasks();

        await firePointer.up(element, {
          pointerId: 1,
          clientX: 0,
          clientY: 80.5,
          bubbles: true,
          timeStamp: releaseTime,
        });

        await flushMicrotasks();

        // Keep the last moving sample (20px / 8ms), unless it is older than 80ms.
        const details = onRelease.mock.calls[0]?.[0];
        expect(details?.releaseVelocityY).toBeCloseTo(expectedVelocity, 4);
        expect(details?.releaseVelocityX).toBeCloseTo(0, 2);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each([
    {
      name: '60 Hz input',
      moves: [
        [1016, 14.4],
        [1032, 28.8],
        [1048, 43.2],
        [1064, 57.6],
      ],
      release: [1080, 57.6],
      expected: 0.9,
    },
    {
      name: '120 Hz input',
      moves: [
        [1008, 7.2],
        [1016, 14.4],
        [1024, 21.6],
        [1032, 28.8],
      ],
      release: [1040, 28.8],
      expected: 0.9,
    },
    {
      name: 'a slower final step',
      moves: [
        [1008, 10],
        [1016, 20],
        [1024, 30],
        [1032, 31],
      ],
      release: [1040, 31],
      expected: 0.125,
    },
    {
      name: 'a flick after a pause',
      moves: [
        [1008, 10],
        [1016, 20],
        [1216, 30],
        [1224, 40],
      ],
      release: [1232, 40],
      expected: 1.25,
    },
    {
      // 8px over 2ms is floored to 4ms.
      name: 'near-simultaneous samples',
      moves: [
        [1008, 10],
        [1010, 18],
      ],
      release: [1018, 18],
      expected: 2,
    },
  ])(
    'measures release velocity from the latest movement ($name)',
    async ({ moves, release, expected }) => {
      const onRelease = vi.fn();

      const SwipeBoxLatestMovement = defineComponent(() => {
        const ref = shallowRef<HTMLDivElement | null>(null);
        const swipe = useSwipeDismiss({
          enabled: true,
          directions: ['down'],
          elementRef: ref,
          movementCssVars: { x: '--x', y: '--y' },
          onRelease,
        });

        return () => (
          <div
            data-testid="release-velocity-latest-movement"
            ref={ref}
            style={swipe.getDragStyles()}
            {...swipe.pointerProps}
          />
        );
      });

      vi.useFakeTimers();
      try {
        await render(<SwipeBoxLatestMovement />);
        const element = screen.getByTestId('release-velocity-latest-movement');

        await firePointer.down(element, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          bubbles: true,
          pointerType: 'mouse',
          movementX: 0,
          movementY: 0,
          timeStamp: 1000,
        });

        await flushMicrotasks();

        let lastY = 0;
        for (const [timeStamp, clientY] of moves) {
          await firePointer.move(element, {
            pointerId: 1,
            buttons: 1,
            clientX: 0,
            clientY,
            bubbles: true,
            movementX: 0,
            movementY: clientY - lastY,
            timeStamp,
          });
          lastY = clientY;
          await flushMicrotasks();
        }

        await firePointer.up(element, {
          pointerId: 1,
          clientX: 0,
          clientY: release[1],
          bubbles: true,
          timeStamp: release[0],
        });

        await flushMicrotasks();

        const details = onRelease.mock.calls[0]?.[0];
        expect(details?.releaseVelocityY).toBeCloseTo(expected, 4);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('keeps release velocity when moves arrive sparsely', async () => {
    const onRelease = vi.fn();

    const SwipeBoxSparseSamples = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-sparse"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxSparseSamples />);
      const element = screen.getByTestId('release-velocity-sparse');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 20,
        bubbles: true,
        movementX: 0,
        movementY: 20,
        timeStamp: 1060,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 200,
        bubbles: true,
        movementX: 0,
        movementY: 180,
        timeStamp: 1120,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 200.5,
        bubbles: true,
        movementX: 0,
        movementY: 0.5,
        timeStamp: 1128,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 200.5,
        bubbles: true,
        timeStamp: 1136,
      });

      await flushMicrotasks();

      // Keep the last moving sample: 180px over 60ms.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBeCloseTo(3, 4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('measures release velocity from the first move rather than the press', async () => {
    const onRelease = vi.fn();

    const SwipeBoxHeldPress = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-held-press"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxHeldPress />);
      const element = screen.getByTestId('release-velocity-held-press');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      // The first move arrives 200ms after the press and re-anchors the drag origin.
      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 5,
        bubbles: true,
        movementX: 0,
        movementY: 5,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 15,
        bubbles: true,
        movementX: 0,
        movementY: 10,
        timeStamp: 1208,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 15,
        bubbles: true,
        timeStamp: 1216,
      });

      await flushMicrotasks();

      // 10px over 8ms. Measuring from the press would report 0.05.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBeCloseTo(1.25, 4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('decays release velocity while the pointer stays pinned', async () => {
    const onRelease = vi.fn();

    const SwipeBoxPinned = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-pinned"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxPinned />);
      const element = screen.getByTestId('release-velocity-pinned');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 20,
        bubbles: true,
        movementX: 0,
        movementY: 20,
        timeStamp: 1016,
      });

      await flushMicrotasks();

      // An off-screen mouse keeps emitting moves at the pinned coordinates.
      for (const timeStamp of [1032, 1048, 1064]) {
        await firePointer.move(element, {
          pointerId: 1,
          buttons: 1,
          clientX: 0,
          clientY: 20,
          bubbles: true,
          movementX: 0,
          movementY: 0,
          timeStamp,
        });
        await flushMicrotasks();
      }

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 20,
        bubbles: true,
        timeStamp: 1072,
      });

      await flushMicrotasks();

      // Repeated stationary samples clear the velocity from the last movement.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not report a previous gesture velocity for a release without movement', async () => {
    const onRelease = vi.fn();

    const SwipeBoxStaleVelocity = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-stale"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxStaleVelocity />);
      const element = screen.getByTestId('release-velocity-stale');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 40,
        bubbles: true,
        movementX: 0,
        movementY: 40,
        timeStamp: 1008,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 120,
        bubbles: true,
        movementX: 0,
        movementY: 80,
        timeStamp: 1016,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 120,
        bubbles: true,
        timeStamp: 1024,
      });

      await flushMicrotasks();

      expect(onRelease.mock.calls[0]?.[0]?.releaseVelocityY).toBeGreaterThan(1);

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 2,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 5000,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 2,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        timeStamp: 5016,
      });

      await flushMicrotasks();

      const secondRelease = onRelease.mock.calls[1]?.[0];
      expect(secondRelease?.releaseVelocityY).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clamps short swipe durations when computing velocity', async () => {
    const onRelease = vi.fn();

    const SwipeBoxReleaseVelocity = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return () => (
        <div
          data-testid="release-velocity-short"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.pointerProps}
        />
      );
    });

    vi.useFakeTimers();
    try {
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-short');

      await firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1005,
      });

      await flushMicrotasks();

      await firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 30,
        clientY: 0,
        bubbles: true,
        movementX: 30,
        movementY: 0,
        timeStamp: 1010,
      });

      await flushMicrotasks();

      await firePointer.up(element, {
        pointerId: 1,
        clientX: 30,
        clientY: 0,
        bubbles: true,
        timeStamp: 1015,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.6, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores pointer interactions that were default prevented', async () => {
    const onSwipeStart = vi.fn();

    const SwipeBoxWithPreventedChild = defineComponent(() => {
      const ref = shallowRef<HTMLDivElement | null>(null);
      const swipeDismiss = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });

      return () => (
        <div
          data-testid="root"
          ref={ref}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.pointerProps}
        >
          <div
            data-testid="child"
            onPointerdown={(event: PointerEvent) => event.preventDefault()}
          />
        </div>
      );
    });

    await render(<SwipeBoxWithPreventedChild />);

    const root = screen.getByTestId('root');
    const child = screen.getByTestId('child');

    await fireEvent.pointerDown(child, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await fireEvent.pointerMove(child, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 150,
      bubbles: true,
      movementX: 0,
      movementY: 50,
    });

    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });
});

const offsets: Record<SwipeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const directionRows = (['up', 'down', 'left', 'right'] as const).map((direction) => ({
  direction,
}));

async function dragWithPointer(element: Element, direction: SwipeDirection, distance: number) {
  const { x, y } = offsets[direction];
  await fireEvent.pointerDown(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: 100,
    clientY: 100,
  });
  // The first move gives the origin of the drag.
  await fireEvent.pointerMove(element, { buttons: 1, pointerId: 1, clientX: 100, clientY: 100 });
  await fireEvent.pointerMove(element, {
    buttons: 1,
    pointerId: 1,
    clientX: 100 + x * distance,
    clientY: 100 + y * distance,
  });
}

async function releasePointer(element: Element, direction: SwipeDirection, distance: number) {
  const { x, y } = offsets[direction];
  await fireEvent.pointerUp(element, {
    pointerId: 1,
    clientX: 100 + x * distance,
    clientY: 100 + y * distance,
  });
}

async function dragWithTouch(element: Element, direction: SwipeDirection, distance: number) {
  const { x, y } = offsets[direction];
  await fireTouch.start(element, {
    touches: [{ clientX: 100, clientY: 100 }],
  });
  await fireTouch.move(element, {
    touches: [{ clientX: 100, clientY: 100 }],
  });
  await fireTouch.move(element, {
    touches: [{ clientX: 100 + x * distance, clientY: 100 + y * distance }],
  });
}

function createSwipeBox(options: {
  directions?: SwipeDirection[];
  onDismiss?: (event: PointerEvent | TouchEvent, details: { direction: SwipeDirection }) => void;
  onSwipingChange?: (swiping: boolean) => void;
  onProgress?: (progress: number) => void;
  canStart?: () => boolean;
  touch?: boolean;
  readSwiping?: boolean;
}) {
  let swipe!: UseSwipeDismissReturnValue;
  const renders = { count: 0 };
  const OptionsBox = defineComponent({
    name: 'OptionsBox',
    props: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: undefined },
      directions: {
        type: Array as PropType<SwipeDirection[]>,
        default: () => options.directions ?? ['down'],
      },
    },
    setup(props) {
      const element = shallowRef<HTMLDivElement | null>(null);
      swipe = useSwipeDismiss({
        enabled: () => props.enabled,
        directions: () => props.directions,
        elementRef: element,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss: options.onDismiss,
        onSwipingChange: options.onSwipingChange,
        onProgress: options.onProgress,
        canStart: options.canStart,
      });

      return () => {
        renders.count += 1;
        return (
          <div
            data-testid="el"
            aria-label={props.label}
            data-swiping={options.readSwiping && swipe.swiping.value ? '' : undefined}
            ref={element}
            style={{ ...swipe.getDragStyles(), width: '200px', height: '200px' }}
            {...(options.touch ? swipe.touchProps : swipe.pointerProps)}
          />
        );
      };
    },
  });

  return { OptionsBox, renders, getSwipe: () => swipe };
}

describe('useSwipeDismiss: directions', () => {
  const { render } = createRenderer();

  it.each(directionRows)(
    'dismisses a pointer swipe to the $direction past the threshold',
    async ({ direction }) => {
      const onDismiss = vi.fn();
      const { OptionsBox } = createSwipeBox({ directions: [direction], onDismiss });
      await render(<OptionsBox />);
      const element = screen.getByTestId('el');

      await dragWithPointer(element, direction, 41);
      const { x, y } = offsets[direction];
      expect(element.style.getPropertyValue('--x')).toBe(`${x * 41}px`);
      expect(element.style.getPropertyValue('--y')).toBe(`${y * 41}px`);

      await releasePointer(element, direction, 41);

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss.mock.calls[0][1]).toEqual({ direction });
    },
  );

  it.each(directionRows)(
    'does not dismiss a pointer swipe to the $direction at the threshold',
    async ({ direction }) => {
      const onDismiss = vi.fn();
      const { OptionsBox } = createSwipeBox({ directions: [direction], onDismiss });
      await render(<OptionsBox />);
      const element = screen.getByTestId('el');

      await dragWithPointer(element, direction, 40);
      await releasePointer(element, direction, 40);

      expect(onDismiss).not.toHaveBeenCalled();
      expect(element.style.getPropertyValue('--x')).toBe('0px');
      expect(element.style.getPropertyValue('--y')).toBe('0px');
    },
  );

  it.each(directionRows)(
    'dismisses a touch swipe to the $direction past the threshold',
    async ({ direction }) => {
      const onDismiss = vi.fn();
      const { OptionsBox } = createSwipeBox({ directions: [direction], onDismiss, touch: true });
      await render(<OptionsBox />);
      const element = screen.getByTestId('el');

      await dragWithTouch(element, direction, 41);
      await fireTouch.end(element, { touches: [] });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss.mock.calls[0][1]).toEqual({ direction });
    },
  );
});

describe('useSwipeDismiss: refs and options', () => {
  const { render } = createRenderer();

  it('gives the swiping state, the direction and the dismissal as refs', async () => {
    const { OptionsBox, getSwipe } = createSwipeBox({});
    await render(<OptionsBox />);
    const element = screen.getByTestId('el');
    const swipe = getSwipe();

    expect([swipe.swiping.value, swipe.swipeDirection.value, swipe.dragDismissed.value]).toEqual([
      false,
      undefined,
      false,
    ]);

    await dragWithPointer(element, 'down', 41);
    expect([swipe.swiping.value, swipe.swipeDirection.value, swipe.dragDismissed.value]).toEqual([
      true,
      'down',
      false,
    ]);

    await releasePointer(element, 'down', 41);
    expect([swipe.swiping.value, swipe.swipeDirection.value, swipe.dragDismissed.value]).toEqual([
      false,
      'down',
      true,
    ]);

    swipe.reset();
    expect([swipe.swiping.value, swipe.swipeDirection.value, swipe.dragDismissed.value]).toEqual([
      false,
      undefined,
      false,
    ]);
  });

  it('ignores each event while it is not enabled, with the same listeners', async () => {
    const onSwipingChange = vi.fn();
    const { OptionsBox, getSwipe } = createSwipeBox({ onSwipingChange });
    const { setProps } = await render(<OptionsBox enabled={false} />);
    const element = screen.getByTestId('el');
    const pointerProps = getSwipe().pointerProps;

    await dragWithPointer(element, 'down', 41);
    expect(onSwipingChange).not.toHaveBeenCalled();
    expect(element.style.getPropertyValue('--y')).toBe('0px');
    await releasePointer(element, 'down', 41);

    await setProps({ enabled: true });
    expect(getSwipe().pointerProps).toBe(pointerProps);

    await dragWithPointer(element, 'down', 41);
    expect(onSwipingChange).toHaveBeenLastCalledWith(true);
  });

  it('reads the directions for each gesture', async () => {
    const onDismiss = vi.fn();
    const { OptionsBox } = createSwipeBox({ onDismiss });
    const { setProps } = await render(<OptionsBox directions={['down']} />);
    const element = screen.getByTestId('el');

    await dragWithPointer(element, 'right', 41);
    await releasePointer(element, 'right', 41);
    expect(onDismiss).not.toHaveBeenCalled();

    await setProps({ directions: ['right'] });

    await dragWithPointer(element, 'right', 41);
    await releasePointer(element, 'right', 41);
    expect(onDismiss.mock.calls[0][1]).toEqual({ direction: 'right' });
  });

  it('adds the touchstart and touchmove listeners as passive listeners', async () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    onTestFinished(() => addEventListener.mockRestore());
    const { OptionsBox } = createSwipeBox({ touch: true });
    await render(<OptionsBox />);

    const options = Object.fromEntries(
      addEventListener.mock.calls
        .filter(([type]) => type.startsWith('touch'))
        .map(([type, , listenerOptions]) => [type, listenerOptions]),
    );
    expect(options).toEqual({
      touchstart: { passive: true },
      touchmove: { passive: true },
      touchend: undefined,
      touchcancel: undefined,
    });
  });

  it('does not start a pending swipe while it is not enabled', async () => {
    const onSwipingChange = vi.fn();
    const canStart = vi.fn(() => false);
    const { OptionsBox } = createSwipeBox({ onSwipingChange, canStart });
    const { setProps } = await render(<OptionsBox />);
    const element = screen.getByTestId('el');

    await fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 100,
    });
    expect(canStart).toHaveBeenCalledTimes(1);

    await setProps({ enabled: false });
    canStart.mockReturnValue(true);
    await fireEvent.pointerMove(element, { buttons: 1, pointerId: 1, clientX: 100, clientY: 120 });

    expect(canStart).toHaveBeenCalledTimes(1);
    expect(onSwipingChange).not.toHaveBeenCalled();
  });

  it('keeps the drag styles in a render during the swipe', async () => {
    const { OptionsBox, renders } = createSwipeBox({ readSwiping: true });
    const { setProps } = await render(<OptionsBox label="a" />);
    const element = screen.getByTestId('el');

    await dragWithPointer(element, 'down', 30);
    expect(element).toHaveAttribute('data-swiping');

    // Vue writes each key of the rendered style again, so this render must give the drag styles.
    const rendersBefore = renders.count;
    await setProps({ label: 'b' });

    expect(renders.count).toBeGreaterThan(rendersBefore);
    expect(element).toHaveAttribute('aria-label', 'b');
    expect(element.style.transition).toBe('none');
    expect(element.style.transform).toMatch(/translate3d\(0px, ?30px, ?0(?:px)?\)/);
    expect(element.style.getPropertyValue('--y')).toBe('30px');
  });
});

describe('useSwipeDismiss: KeepAlive', () => {
  const { render } = createRenderer();

  it('VUE-5: ends a swipe when KeepAlive deactivates the element', async () => {
    const onDismiss = vi.fn();
    const onSwipingChange = vi.fn();
    const onProgress = vi.fn();
    const { OptionsBox, getSwipe } = createSwipeBox({ onDismiss, onSwipingChange, onProgress });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
    const shown = shallowRef(true);
    await render(() => (
      <KeepAlive>{shown.value ? <OptionsBox key="box" /> : <Other key="other" />}</KeepAlive>
    ));
    const element = screen.getByTestId('el');

    await dragWithPointer(element, 'down', 60);
    expect(getSwipe().swiping.value).toBe(true);
    expect(element.style.transition).toBe('none');

    shown.value = false;
    await flushMicrotasks();

    expect(getSwipe().swiping.value).toBe(false);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(onProgress).toHaveBeenLastCalledWith(0, undefined);
    expect(onDismiss).not.toHaveBeenCalled();

    shown.value = true;
    await flushMicrotasks();

    expect(screen.getByTestId('el')).toBe(element);
    expect(element.style.transition).toBe('');
    expect(element.style.transform).toBe('');
    expect(element.style.getPropertyValue('--y')).toBe('0px');
  });
});

describe('useSwipeDismiss: real input', () => {
  const { render } = createRenderer();

  it('follows a real pointer that leaves the element, with the pointer capture', async () => {
    const onDismiss = vi.fn();
    const { OptionsBox } = createSwipeBox({ onDismiss });
    await render(<OptionsBox />);
    const element = screen.getByTestId('el');
    const rect = element.getBoundingClientRect();
    onTestFinished(async () => {
      await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
    });
    const captures: string[] = [];
    element.addEventListener('gotpointercapture', () => captures.push('got'));
    element.addEventListener('lostpointercapture', () => captures.push('lost'));

    await userEvent.pointer({
      target: element,
      coords: { x: rect.width / 2, y: rect.height - 10 },
      keys: '[MouseLeft>]',
    });
    await userEvent.pointer({
      coords: { x: rect.left + rect.width / 2, y: rect.bottom - 5 },
    });
    // This position is below the element. Only a captured pointer sends the move to the element.
    await userEvent.pointer({
      coords: { x: rect.left + rect.width / 2, y: rect.bottom + 80 },
    });

    expect(captures).toEqual(['got']);
    expect(Number.parseFloat(element.style.getPropertyValue('--y'))).toBeGreaterThan(40);

    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(captures).toEqual(['got', 'lost']);
  });
});
