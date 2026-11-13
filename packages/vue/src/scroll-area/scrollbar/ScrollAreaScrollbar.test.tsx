import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, createSSRApp, defineComponent, nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import type { ScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import ScrollAreaScrollbarHydration from './ScrollAreaScrollbarHydration.test.vue';

// `data-id` holds an id that Vue generates, so it can differ between two apps.
function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter(({ name }) => name !== 'data-id')
      .map(({ name, value }) => [name, name === 'style' ? element.style.cssText : value]),
  );
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
  });

  describe('prop: orientation', () => {
    it('moves its element to the holder of the new orientation', async () => {
      const orientation = shallowRef<'vertical' | 'horizontal'>('vertical');
      let rootContext!: ScrollAreaRootContext;
      // The holders are in the context of the root. Nothing else shows them until the thumb exists.
      const Probe = defineComponent(() => {
        rootContext = useScrollAreaRootContext();
        return () => null;
      });
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
