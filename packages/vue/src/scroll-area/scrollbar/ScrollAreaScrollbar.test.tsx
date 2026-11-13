import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createApp, createSSRApp, defineComponent, nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
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
  within,
} from '#test-utils';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import type { ScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { SCROLL_TIMEOUT } from '../constants';
import ScrollAreaScrollbarHydration from './ScrollAreaScrollbarHydration.test.vue';

// `data-id` holds an id that Vue generates, so it can differ between two apps.
function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter(({ name }) => name !== 'data-id')
      .map(({ name, value }) => [name, name === 'style' ? element.style.cssText : value]),
  );
}

// The pointer of the browser stays where a case leaves it, for each later test. A call with no
// coordinates would move the pointer to the element of the last press, which is gone by then.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<ScrollArea.Scrollbar />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Scrollbar keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<ScrollArea.Root>{node}</ScrollArea.Root>);
    },
  }));

  it('is hidden from the accessibility tree by default', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>,
    );

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" aria-hidden={undefined} />
      </ScrollArea.Root>,
    );

    expect(screen.getByTestId('scrollbar')).not.toHaveAttribute('aria-hidden');
  });

  it('sets the orientation data attribute', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>,
    );

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('supports a custom scrollbar renderer that does not forward its ref', async () => {
    // The attributes go to the root element of the component. It exposes no element.
    const ScrollbarWithoutRef = defineComponent({
      setup(_, { expose }) {
        expose({ element: null });
        return () => <div />;
      },
    });

    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport />
        <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted as={ScrollbarWithoutRef} />
      </ScrollArea.Root>,
    );

    expect(screen.getByTestId('scrollbar')).toBeInTheDocument();
  });

  describe('data-scrolling attribute', () => {
    const { render: renderWithFakeTimers } = createRenderer();

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled in the correct direction', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted />
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal" keepMounted />
          <ScrollArea.Corner />
        </ScrollArea.Root>,
      );

      const verticalScrollbar = screen.getByTestId('vertical');
      const horizontalScrollbar = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, {
        target: {
          scrollTop: 1,
        },
      });

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling', '');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT - 1);
      await flushMicrotasks();

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling', '');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: 1,
        },
      });

      await vi.advanceTimersByTimeAsync(1); // vertical just finished
      await flushMicrotasks();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT - 2); // already ticked 1ms above
      await flushMicrotasks();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');
    });
  });

  describe('data-hovering attribute', () => {
    it('detects a viewport that is already hovered on mount', async () => {
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

      try {
        await render(
          <ScrollArea.Root>
            <ScrollArea.Viewport data-testid="viewport" />
            <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>,
        );

        await waitFor(() =>
          expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-hovering'),
        );
      } finally {
        matchesSpy.mockRestore();
      }
    });

    // The native `pointerenter` and `pointerleave` do not bubble, and the helper dispatches them
    // with `bubbles: false`. React makes them from `pointerover` and `pointerout`, so the upstream
    // case fires them on the viewport. Here they go to the root, which has the listeners.
    it('does not enter hover state for touch pointers', async () => {
      await render(
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const scrollbar = screen.getByTestId('scrollbar');

      // The real pointer of the browser can be over the root. The start state has no hover.
      await fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      expect(scrollbar).not.toHaveAttribute('data-hovering');

      await fireEvent.pointerEnter(root, { pointerType: 'touch' });

      expect(scrollbar).not.toHaveAttribute('data-hovering');
    });

    it('adds [data-hovering] when a mouse pointer enters the root, and removes it when the pointer leaves', async () => {
      await render(
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const scrollbar = screen.getByTestId('scrollbar');

      await fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      expect(scrollbar).not.toHaveAttribute('data-hovering');

      await fireEvent.pointerEnter(root, { pointerType: 'mouse' });
      expect(scrollbar).toHaveAttribute('data-hovering', '');

      await fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      expect(scrollbar).not.toHaveAttribute('data-hovering');
    });
  });

  describe('track pointer down', () => {
    it('ignores non-primary pointer presses', async () => {
      await render(
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" style={{ scrollSnapType: 'y mandatory' }} />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');
      await fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 2,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('handles a track press when no viewport is mounted', async () => {
      await render(
        <ScrollArea.Root>
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const scrollbar = screen.getByTestId('scrollbar');
      await fireEvent.pointerDown(scrollbar, { button: 0, clientY: 100, pointerId: 1 });

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not start a track gesture without a thumb', async () => {
      await render(
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" style={{ scrollSnapType: 'y mandatory' }} />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');
      await fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 0,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores thumb clicks when the native path differs from the synthetic target', async () => {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperty(thumb, 'offsetHeight', {
        configurable: true,
        value: 40,
      });

      const event = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientY: 160,
      });

      Object.defineProperty(event, 'composedPath', {
        configurable: true,
        value: () => [thumb, verticalScrollbar],
      });

      await fireEvent(verticalScrollbar, event);

      expect(viewport.scrollTop).toBe(0);
    });

    it('marks the scroll area as scrolling when pressing the track', async () => {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperties(thumb, {
        offsetHeight: {
          configurable: true,
          value: 40,
        },
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
      });

      await fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });

      expect(viewport.scrollTop).not.toBe(0);
      // The scrolling state lasts 500 ms. `fireEvent` resolves after the Vue flush in the same
      // task, so no timer can end the state before the assertion.
      expect(verticalScrollbar).toHaveAttribute('data-scrolling');
    });

    it('clears track drag state on pointer cancel', async () => {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperties(thumb, {
        offsetHeight: {
          configurable: true,
          value: 40,
        },
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
        hasPointerCapture: {
          configurable: true,
          value: () => false,
        },
      });

      await fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });

      const scrollTopAfterTrackPress = viewport.scrollTop;

      await fireEvent.pointerCancel(verticalScrollbar, { pointerId: 1 });
      await fireEvent.pointerMove(thumb, { clientY: 180, pointerId: 1, buttons: 1 });

      expect(viewport.scrollTop).toBe(scrollTopAfterTrackPress);
    });
  });

  // A synthetic `mousedown` does not move the focus. These cases assert the cancellation that stops
  // the focus change, and not the `activeElement`.
  describe('track mouse down', () => {
    async function renderScrollbarWithThumb() {
      await render(
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );
    }

    // Native scrollbars keep focus for every button, not just the primary one.
    it.each([
      { name: 'primary', button: 0 },
      { name: 'middle', button: 1 },
      { name: 'secondary', button: 2 },
    ])(
      'cancels a $name press on the track so focus stays on the active element',
      async ({ button }) => {
        await renderScrollbarWithThumb();

        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button });
        screen.getByTestId('scrollbar').dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
      },
    );

    it('cancels the press on the thumb so focus stays on the active element', async () => {
      await renderScrollbarWithThumb();

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      screen.getByTestId('thumb').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // The vertical and horizontal track-click branches share one axis-parameterized path. `getOffset`
  // reads logical margins and paddings, so these cases run against real layout. They pin the
  // horizontal LTR path and the RTL inversion. A press on the track takes the pointer capture of the
  // thumb, so each case presses with the real pointer of the browser. The track has a cross size,
  // because a real pointer cannot press an element with no area.
  describe.skipIf(isJSDOM)('track click by axis', () => {
    async function renderAxisTrack(
      orientation: 'horizontal' | 'vertical',
      direction: TextDirection,
    ) {
      await render(
        <DirectionProvider direction={direction}>
          <ScrollArea.Root style={{ width: '200px', height: '200px', direction }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '1000px', height: '1000px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation={orientation}
              data-testid="scrollbar"
              keepMounted
              style={orientation === 'vertical' ? { width: '10px' } : { height: '10px' }}
            >
              <ScrollArea.Thumb data-testid="thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      await waitFor(() => expect(thumb.offsetWidth + thumb.offsetHeight).toBeGreaterThan(0));

      return { viewport, scrollbar };
    }

    it('scrolls down when clicking below the thumb on a vertical track', async () => {
      const { viewport, scrollbar } = await renderAxisTrack('vertical', 'ltr');
      const rect = scrollbar.getBoundingClientRect();
      releasePointerAfterTest();

      await userEvent.pointer({
        target: scrollbar,
        coords: { x: rect.width / 2, y: rect.height - 5 },
        keys: '[MouseLeft>]',
      });

      expect(viewport.scrollTop).toBeGreaterThan(0);
    });

    it('scrolls right when clicking the end of a horizontal LTR track', async () => {
      const { viewport, scrollbar } = await renderAxisTrack('horizontal', 'ltr');
      const rect = scrollbar.getBoundingClientRect();
      releasePointerAfterTest();

      await userEvent.pointer({
        target: scrollbar,
        coords: { x: rect.width - 5, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });

      expect(viewport.scrollLeft).toBeGreaterThan(0);
    });

    it('scrolls into the negative RTL range when clicking a horizontal RTL track', async () => {
      const { viewport, scrollbar } = await renderAxisTrack('horizontal', 'rtl');
      const rect = scrollbar.getBoundingClientRect();
      releasePointerAfterTest();

      await userEvent.pointer({
        target: scrollbar,
        coords: { x: 5, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });

      expect(viewport.scrollLeft).toBeLessThan(0);
    });
  });

  // The jump-to-click assignment must run with snapping already disabled, or the
  // assigned position quantizes to the nearest snap point and the thumb stays
  // offset from the pointer for the whole drag. Requires real layout for the
  // track/thumb offset math. The press and the release are those of the real pointer. The thumb has
  // the capture, so it gets the `pointerup`.
  describe.skipIf(isJSDOM)('scroll snap on track press', () => {
    it('does not snap the initial jump-to-click position', async () => {
      await render(
        <ScrollArea.Root style={{ width: '400px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', scrollSnapType: 'x mandatory' }}
          >
            <div style={{ display: 'flex' }}>
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  style={{
                    flexShrink: 0,
                    width: '200px',
                    height: '100px',
                    scrollSnapAlign: 'start',
                  }}
                />
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            data-testid="scrollbar"
            keepMounted
            style={{ height: '10px' }}
          >
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      await waitFor(() => expect(thumb.offsetWidth).toBeGreaterThan(0));
      releasePointerAfterTest();

      // Aim mid-way between the 800 and 1000 snap points (200px items).
      const targetScroll = 900;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      const maxThumbOffset = scrollbar.offsetWidth - thumb.offsetWidth;
      const rect = scrollbar.getBoundingClientRect();
      const clickX = (targetScroll / maxScroll) * maxThumbOffset + thumb.offsetWidth / 2;

      await userEvent.pointer({
        target: scrollbar,
        coords: { x: clickX, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });

      expect(Math.abs(viewport.scrollLeft - targetScroll)).toBeLessThanOrEqual(1);

      // Releasing restores snapping, which re-snaps to the nearest snap point.
      await userEvent.pointer({ keys: '[/MouseLeft]' });
      await waitFor(() => expect(viewport.scrollLeft % 200).toBe(0));
    });
  });

  // A short or heavily padded track drives `maxThumbOffset` to zero or negative
  // once the thumb hits its `MIN_THUMB_SIZE` floor. Dragging the thumb then
  // divides by a non-positive offset, teleporting the scroll position to an
  // extreme instead of moving proportionally. Asserted with real layout: a 16px
  // track ties the floored thumb to the track length (offset 0); a 10px track is
  // shorter than the floored thumb (negative offset). A drag takes the pointer capture of the
  // thumb, so the two drag cases use the real pointer of the browser. A press on the track returns
  // before the capture, so the two click cases fire a synthetic event.
  describe.skipIf(isJSDOM)('non-positive thumb offset', () => {
    async function renderShortTrack(trackHeight: number) {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical"
            keepMounted
            style={{ height: `${trackHeight}px`, bottom: 'auto', width: '12px' }}
          >
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');
      await waitFor(() => expect(thumb.offsetHeight).toBeGreaterThan(0));

      return { viewport, verticalScrollbar, thumb };
    }

    it('does not jump the scroll when dragging a thumb that fills the track', async () => {
      const { viewport, thumb } = await renderShortTrack(16);
      const rect = thumb.getBoundingClientRect();
      releasePointerAfterTest();

      // Park the scroll mid-range so an erroneous jump to an edge is detectable.
      viewport.scrollTop = 400;
      await userEvent.pointer({
        target: thumb,
        coords: { x: rect.width / 2, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });
      await userEvent.pointer({
        coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 + 5 },
      });

      expect(viewport.scrollTop).toBe(400);
    });

    it('does not jump the scroll when dragging a thumb taller than the track', async () => {
      const { viewport, thumb } = await renderShortTrack(10);
      const rect = thumb.getBoundingClientRect();
      releasePointerAfterTest();

      viewport.scrollTop = 400;
      await userEvent.pointer({
        target: thumb,
        coords: { x: rect.width / 2, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });
      await userEvent.pointer({
        coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 + 5 },
      });

      expect(viewport.scrollTop).toBe(400);
    });

    it('does not jump the scroll when clicking a track whose thumb fills the track', async () => {
      const { viewport, verticalScrollbar } = await renderShortTrack(16);

      viewport.scrollTop = 400;
      await fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 5, pointerId: 1 });

      expect(viewport.scrollTop).toBe(400);
    });

    it('does not jump the scroll when clicking a track whose thumb is taller than the track', async () => {
      const { viewport, verticalScrollbar } = await renderShortTrack(10);

      viewport.scrollTop = 400;
      await fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 5, pointerId: 1 });

      expect(viewport.scrollTop).toBe(400);
    });
  });

  describe('prop: orientation', () => {
    let rootContext!: ScrollAreaRootContext;
    const Probe = defineComponent(() => {
      rootContext = useScrollAreaRootContext();
      return () => null;
    });

    it('puts the element of each scrollbar in the holder of its orientation on mount', async () => {
      await render(
        <ScrollArea.Root>
          <Probe />
          <ScrollArea.Scrollbar data-testid="vertical" keepMounted />
          <ScrollArea.Scrollbar data-testid="horizontal" orientation="horizontal" keepMounted />
        </ScrollArea.Root>,
      );

      expect(rootContext.scrollbarYElement.value).toBe(screen.getByTestId('vertical'));
      expect(rootContext.scrollbarXElement.value).toBe(screen.getByTestId('horizontal'));
    });

    it('moves its element to the holder of the new orientation', async () => {
      const orientation = shallowRef<'vertical' | 'horizontal'>('vertical');
      const App = defineComponent(() => () => (
        <ScrollArea.Root>
          <Probe />
          <ScrollArea.Scrollbar
            data-testid="scrollbar"
            keepMounted
            orientation={orientation.value}
          />
        </ScrollArea.Root>
      ));

      await render(<App />);
      const scrollbar = screen.getByTestId('scrollbar');

      expect(rootContext.scrollbarYElement.value).toBe(scrollbar);
      expect(rootContext.scrollbarXElement.value).toBe(null);

      orientation.value = 'horizontal';
      await nextTick();

      expect(scrollbar).toHaveAttribute('data-orientation', 'horizontal');
      expect(rootContext.scrollbarYElement.value).toBe(null);
      expect(rootContext.scrollbarXElement.value).toBe(scrollbar);
    });
  });

  describe('wheel', () => {
    async function renderWheelTest(props: {
      direction?: TextDirection;
      orientation?: 'horizontal' | 'vertical';
      scrollLeft?: number;
      scrollTop?: number;
    }) {
      const {
        direction = 'ltr',
        orientation = 'horizontal',
        scrollLeft = 0,
        scrollTop = 0,
      } = props;

      await render(
        <DirectionProvider direction={direction}>
          <ScrollArea.Root style={{ width: '200px', height: '200px', direction }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '1000px', height: '1000px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        clientWidth: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollWidth: {
          configurable: true,
          value: 1000,
        },
        scrollLeft: {
          configurable: true,
          writable: true,
          value: scrollLeft,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: scrollTop,
        },
      });

      return { viewport, scrollbar };
    }

    it('allows horizontal scrolling away from the RTL start edge', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'rtl' });

      await fireEvent.wheel(scrollbar, { deltaX: -50 });

      expect(viewport.scrollLeft).toBe(-50);
    });

    it('clamps horizontal LTR wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'ltr' });

      await fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = 790;
      await fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);

      await fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);
    });

    it('clamps horizontal RTL wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'rtl' });

      await fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = -100;
      await fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(-50);

      viewport.scrollLeft = -790;
      await fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      await fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      viewport.scrollLeft = -10;
      await fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);
    });

    it('clamps vertical wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      await fireEvent.wheel(scrollbar, { deltaY: -50 });
      expect(viewport.scrollTop).toBe(0);

      viewport.scrollTop = 790;
      await fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);

      await fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);
    });

    it('preventDefaults only when it consumes the scroll, allowing chaining at edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      // Mid-range: the wheel scroll is consumed, so the event is cancelled.
      viewport.scrollTop = 400;
      // `fireEvent` returns the `dispatchEvent` result: `false` when `preventDefault` was called.
      expect(await fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(false);

      // At the end edge scrolling further: not consumed, so the event chains to the parent/page.
      viewport.scrollTop = 800;
      expect(await fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(true);

      // At the start edge scrolling further backward, the event chains too.
      viewport.scrollTop = 0;
      expect(await fireEvent.wheel(scrollbar, { deltaY: -50 })).toBe(true);
    });

    it('ignores zero-delta wheel events', async () => {
      const { viewport, scrollbar } = await renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(await fireEvent.wheel(scrollbar, { deltaY: 0 })).toBe(true);
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not intercept browser zoom gestures', async () => {
      const { viewport, scrollbar } = await renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(await fireEvent.wheel(scrollbar, { ctrlKey: true, deltaY: 50 })).toBe(true);
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    // The scrolling state lasts 500 ms. `fireEvent` resolves after the Vue flush in the same task,
    // so no timer can end the state before the assertion.
    it('marks the scroll area as scrolling when wheeling over the scrollbar', async () => {
      const { scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      await fireEvent.wheel(scrollbar, { deltaY: 50 });

      expect(scrollbar).toHaveAttribute('data-scrolling');
    });

    it('marks the scroll area as scrolling when wheeling over the horizontal scrollbar', async () => {
      const { scrollbar } = await renderWheelTest({ orientation: 'horizontal' });

      await fireEvent.wheel(scrollbar, { deltaX: 50 });

      expect(scrollbar).toHaveAttribute('data-scrolling');
    });

    it('does not mark the scroll area as scrolling when chaining at an edge', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      // At the end edge scrolling further chains to the page without consuming the
      // scroll, so the area must not be marked as scrolling.
      viewport.scrollTop = 800;
      await fireEvent.wheel(scrollbar, { deltaY: 50 });

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it.skipIf(isJSDOM)('registers after the horizontal scrollbar becomes visible', async () => {
      await render(
        <DirectionProvider direction="rtl">
          <ScrollArea.Root style={{ width: '200px', height: '200px', direction: 'rtl' }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '1000px', height: '200px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const horizontalScrollbar = await screen.findByTestId('horizontal');

      await waitFor(() => expect(horizontalScrollbar).toHaveAttribute('data-has-overflow-x'));

      await fireEvent.wheel(horizontalScrollbar, { deltaX: -50 });

      expect(viewport.scrollLeft).toBe(-50);
    });
  });

  describe.skipIf(isJSDOM)('data overflow attributes (scrollbars)', () => {
    const VIEWPORT_SIZE = 200;
    const SCROLLABLE_CONTENT_SIZE = 1000;

    it('applies data attributes on vertical and horizontal scrollbars', async () => {
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
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');
      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      await waitFor(() => {
        expect({
          vHasOverflowY: vScrollbar.hasAttribute('data-has-overflow-y'),
          vOverflowYStart: vScrollbar.hasAttribute('data-overflow-y-start'),
          vOverflowYEnd: vScrollbar.hasAttribute('data-overflow-y-end'),
          hHasOverflowX: hScrollbar.hasAttribute('data-has-overflow-x'),
          hOverflowXStart: hScrollbar.hasAttribute('data-overflow-x-start'),
          hOverflowXEnd: hScrollbar.hasAttribute('data-overflow-x-end'),
        }).toEqual({
          vHasOverflowY: true,
          vOverflowYStart: false,
          vOverflowYEnd: true,
          hHasOverflowX: true,
          hOverflowXStart: false,
          hOverflowXEnd: true,
        });
      });

      // Scroll to middle
      const halfY = (viewport.scrollHeight - viewport.clientHeight) / 2;
      const halfX = (viewport.scrollWidth - viewport.clientWidth) / 2;
      await fireEvent.scroll(viewport, {
        target: { scrollTop: halfY, scrollLeft: halfX },
      });
      await flushMicrotasks();

      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-end');
    });
  });

  describe('hydration', () => {
    it('hydrates a kept scrollbar, and mounts the other scrollbar after the measurement', async () => {
      // The `hydrate` helper compares after two ticks. The scrollbars change after the
      // measurement, so the test hydrates by hand and waits for them.
      const serverHtml = await renderOnServer(
        'src/scroll-area/scrollbar/ScrollAreaScrollbarHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const kept = within(container).getByTestId('kept');
      expect(within(container).queryByTestId('measured')).toBe(null);

      const hydratingApp = createSSRApp(ScrollAreaScrollbarHydration);
      onTestFinished(() => {
        hydratingApp.unmount();
        container.remove();
      });
      hydratingApp.mount(container);

      await waitFor(() => expect(kept).toHaveAttribute('data-has-overflow-y'));
      const measured = await within(container).findByTestId('measured');
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('kept')).toBe(kept);
      expect(takeReportedMessages()).toEqual([]);

      const clientContainer = document.createElement('div');
      document.body.append(clientContainer);
      const clientApp = createApp(ScrollAreaScrollbarHydration);
      onTestFinished(() => {
        clientApp.unmount();
        clientContainer.remove();
      });
      clientApp.mount(clientContainer);
      const clientKept = within(clientContainer).getByTestId('kept');

      await waitFor(() => expect(clientKept).toHaveAttribute('data-has-overflow-y'));
      const clientMeasured = await within(clientContainer).findByTestId('measured');

      expect(readAttributes(kept)).toEqual(readAttributes(clientKept));
      expect(readAttributes(measured)).toEqual(readAttributes(clientMeasured));
    });
  });
});
