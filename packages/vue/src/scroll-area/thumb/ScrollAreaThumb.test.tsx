import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  KeepAlive,
  createApp,
  createSSRApp,
  defineComponent,
  nextTick,
  provide,
  shallowRef,
} from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  expectSetupErrorWarnings,
  fireEvent,
  flushMicrotasks,
  installPartsInterop,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import {
  SCROLL_TIMEOUT,
  ScrollAreaRootContext,
  useScrollAreaRootContext,
} from '../root/ScrollAreaRootContext';
import ScrollAreaThumbHydration from './ScrollAreaThumbHydration.test.vue';

function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes).map(({ name, value }) => [
      name,
      name === 'style' ? element.style.cssText : value,
    ]),
  );
}

describe('<ScrollArea.Thumb />', () => {
  const { render } = createRenderer();

  let rootContext!: ScrollAreaRootContext;
  // The holders are in the context of the root. Nothing else shows them.
  const Probe = defineComponent(() => {
    rootContext = useScrollAreaRootContext();
    return () => null;
  });

  describeConformance(<ScrollArea.Thumb />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <ScrollArea.Root>
          <ScrollArea.Scrollbar keepMounted>{node}</ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );
    },
  }));

  it('handles a thumb gesture when no viewport is mounted', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
    });

    await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    await fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });

    // Without a viewport there is nothing to scroll, so the drag never consumes the move.
    expect(thumb).not.toHaveAttribute('data-scrolling');
    expect(thumb.style.transform).toBe('');

    await fireEvent.pointerUp(thumb, { pointerId: 1 });
    expect(thumb).not.toHaveAttribute('data-scrolling');
  });

  it('VUE-140: restores the inline snap priority on lost capture and accepts the next style', async () => {
    const snap = shallowRef('x mandatory');
    const label = shallowRef('first');
    await render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport
          data-testid="viewport"
          data-label={label.value}
          style={{ scrollSnapType: snap.value }}
        />
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(thumb, 'setPointerCapture').mockImplementation(() => {});
    viewport.style.setProperty('scroll-snap-type', 'x mandatory', 'important');
    await fireEvent.pointerDown(thumb, { button: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    await fireEvent(thumb, new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
    expect(viewport.style.scrollSnapType).toBe('x mandatory');
    expect(viewport.style.getPropertyPriority('scroll-snap-type')).toBe('important');
    viewport.style.setProperty('scroll-snap-type', 'both mandatory');
    label.value = 'second';
    await nextTick();
    expect(viewport.style.scrollSnapType).toBe('both mandatory');

    snap.value = 'y mandatory';
    await nextTick();
    expect(viewport.style.scrollSnapType).toBe('y mandatory');
    expect(viewport.style.getPropertyPriority('scroll-snap-type')).toBe('');
  });

  it('ignores capture loss from a replaced thumb during the next drag', async () => {
    const replace = shallowRef(false);
    await render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" style={{ scrollSnapType: 'y mandatory' }} />
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="previous" />
          {replace.value && <ScrollArea.Thumb data-testid="current" />}
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    const press = { button: 0, pointerId: 1 };
    const previous = screen.getByTestId('previous');
    vi.spyOn(previous, 'setPointerCapture').mockImplementation(() => {});
    await fireEvent.pointerDown(previous, press);
    replace.value = true;
    await nextTick();
    const viewport = screen.getByTestId('viewport');
    expect(viewport.style.scrollSnapType).toBe('y mandatory');

    const current = screen.getByTestId('current');
    vi.spyOn(current, 'setPointerCapture').mockImplementation(() => {});
    await fireEvent.pointerDown(current, press);
    await fireEvent(
      previous,
      new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }),
    );
    expect(viewport.style.scrollSnapType).toBe('none');
    await fireEvent.pointerUp(current, press);
    expect(viewport.style.scrollSnapType).toBe('y mandatory');
  });

  it('VUE-140: saves a fresh snap value after a press ends before the patch', async () => {
    const label = shallowRef('first');
    await render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" data-label={label.value} />
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(thumb, 'setPointerCapture').mockImplementation(() => {});
    const press = { button: 0, pointerId: 1 };
    viewport.style.setProperty('scroll-snap-type', 'x mandatory');
    await Promise.all([fireEvent.pointerDown(thumb, press), fireEvent.pointerUp(thumb, press)]);
    viewport.style.setProperty('scroll-snap-type', 'y mandatory', 'important');
    label.value = 'second';
    await nextTick();
    expect(viewport.style.scrollSnapType).toBe('y mandatory');
    await fireEvent.pointerDown(thumb, press);
    expect(viewport.style.scrollSnapType).toBe('none');
    await fireEvent.pointerUp(thumb, press);
    expect(viewport.style.scrollSnapType).toBe('y mandatory');
    expect(viewport.style.getPropertyPriority('scroll-snap-type')).toBe('important');
  });

  it.each(['before', 'after'])(
    'VUE-140: keeps a script change between two presses %s the first patch',
    async (when) => {
      await render(
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );
      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      vi.spyOn(thumb, 'setPointerCapture').mockImplementation(() => {});
      const pointer = { button: 0, pointerId: 1 };
      viewport.style.scrollSnapType = 'x mandatory';
      const firstDown = fireEvent.pointerDown(thumb, pointer);
      if (when === 'after') {
        await firstDown;
        expect(viewport.style.scrollSnapType).toBe('none');
      }
      const firstUp = fireEvent.pointerUp(thumb, pointer);
      const nextSnap = when === 'before' ? 'none' : 'y mandatory';
      viewport.style.setProperty('scroll-snap-type', nextSnap, 'important');
      await Promise.all([firstDown, firstUp, fireEvent.pointerDown(thumb, pointer)]);
      expect(viewport.style.scrollSnapType).toBe('none');
      await Promise.all([
        fireEvent.pointerUp(thumb, pointer),
        fireEvent.pointerDown(thumb, pointer),
      ]);
      await fireEvent.pointerUp(thumb, pointer);
      expect(viewport.style.scrollSnapType).toBe(nextSnap);
      expect(viewport.style.getPropertyPriority('scroll-snap-type')).toBe('important');
    },
  );

  it.each(['viewport', 'thumb'])('ends the press when only the %s enters a hold', async (part) => {
    const shown = shallowRef(true);
    await render(() => (
      <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
        <KeepAlive>
          {(part !== 'viewport' || shown.value) && (
            <ScrollArea.Viewport data-testid="viewport" style={{ height: '100%' }}>
              <div style={{ height: '1000px' }} />
            </ScrollArea.Viewport>
          )}
        </KeepAlive>
        <ScrollArea.Scrollbar keepMounted data-testid="track">
          <KeepAlive>
            {(part !== 'thumb' || shown.value) && <ScrollArea.Thumb data-testid="thumb" />}
          </KeepAlive>
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    const capture = vi.spyOn(thumb, 'setPointerCapture').mockImplementation(() => {});
    viewport.style.setProperty('scroll-snap-type', 'both mandatory', 'important');
    await fireEvent.pointerDown(thumb, { button: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    shown.value = false;
    await nextTick();
    expect(viewport.style.scrollSnapType).toBe('both mandatory');
    expect(viewport.style.getPropertyPriority('scroll-snap-type')).toBe('important');
    const target = part === 'viewport' ? thumb : screen.getByTestId('track');
    await fireEvent.pointerDown(target, { button: 0, pointerId: 2, clientY: 80 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(viewport.style.scrollSnapType).toBe('both mandatory');
    shown.value = true;
    await nextTick();
    await fireEvent.pointerMove(thumb, { buttons: 1, pointerId: 1, clientY: 40 });
    expect(thumb).not.toHaveAttribute('data-scrolling');
  });

  it('handles the scrollbar unmounting from a user pointer-move callback', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" />
        <Probe />
      </ScrollArea.Root>,
    );

    // The viewport must stay, or the case proves only the guard of the viewport. Vue has no public
    // call that unmounts one part of an app at once, so the scrollbar is in a second app. That app
    // gets the context of the root.
    const ScrollbarWithRootContext = defineComponent(() => {
      provide(ScrollAreaRootContext, rootContext);
      return () => (
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar">
          <ScrollArea.Thumb data-testid="thumb" onPointermove={() => scrollbarApp.unmount()} />
        </ScrollArea.Scrollbar>
      );
    });
    const scrollbarApp: VaseUIRenderResult = await render(<ScrollbarWithRootContext />);

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperty(thumb, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    });

    await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    await fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });

    expect(screen.queryByTestId('scrollbar')).toBe(null);
    expect(viewport.scrollTop).toBe(0);
  });

  it('handles the viewport unmounting from a user pointer-up callback', async () => {
    const view: VaseUIRenderResult = await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" style={{ scrollSnapType: 'y mandatory' }} />
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" onPointerup={() => view.unmount()} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
    });

    await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    await fireEvent.pointerUp(thumb, { pointerId: 1 });
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  describe.skipIf(isJSDOM)('horizontal dragging', () => {
    async function renderHorizontal(direction: 'ltr' | 'rtl') {
      const { user } = await render(
        <DirectionProvider direction={direction}>
          <ScrollArea.Root style={{ width: '200px', height: '200px', direction }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '1000px', height: '200px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="horizontal"
              data-testid="scrollbar"
              keepMounted
              style={{ display: 'flex', width: '200px', height: '10px' }}
            >
              <ScrollArea.Thumb data-testid="thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const viewport = screen.getByTestId('viewport');
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      await waitFor(() => expect(thumb.offsetWidth).toBeGreaterThan(0));

      return { scrollbar, thumb, user, viewport };
    }

    it('updates LTR scroll position and pointer capture state', async () => {
      const { scrollbar, thumb, user, viewport } = await renderHorizontal('ltr');
      const setPointerCapture = vi.spyOn(thumb, 'setPointerCapture').mockImplementation(() => {});
      vi.spyOn(thumb, 'hasPointerCapture').mockReturnValue(true);
      const releasePointerCapture = vi
        .spyOn(thumb, 'releasePointerCapture')
        .mockImplementation(() => {});
      const rect = thumb.getBoundingClientRect();

      await user.pointer({
        target: thumb,
        coords: { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 },
        keys: '[MouseLeft>]',
      });
      await user.pointer({
        target: thumb,
        coords: { clientX: rect.left + rect.width / 2 + 20, clientY: rect.top + rect.height / 2 },
      });

      expect(setPointerCapture).toHaveBeenCalledTimes(1);
      expect(viewport.scrollLeft).toBeGreaterThan(0);
      expect(scrollbar).toHaveAttribute('data-scrolling');

      await user.pointer({ keys: '[/MouseLeft]' });

      expect(releasePointerCapture).toHaveBeenCalled();
    });

    it('uses the negative RTL range and clears scrolling on pointer cancel', async () => {
      const { scrollbar, thumb, viewport } = await renderHorizontal('rtl');
      const rect = thumb.getBoundingClientRect();
      let pointerId = -1;
      thumb.addEventListener('pointerdown', (event) => {
        pointerId = event.pointerId;
      });
      // A button of the real pointer stays pressed for each later test until a case releases it.
      onTestFinished(async () => {
        await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
      });

      await userEvent.pointer({
        target: thumb,
        coords: { x: rect.width / 2, y: rect.height / 2 },
        keys: '[MouseLeft>]',
      });
      await userEvent.pointer({
        coords: { x: rect.left + rect.width / 2 - 20, y: rect.top + rect.height / 2 },
      });

      expect(viewport.scrollLeft).toBeLessThan(0);
      expect(scrollbar).toHaveAttribute('data-scrolling');

      await fireEvent.pointerCancel(thumb, { pointerId });

      expect(scrollbar).not.toHaveAttribute('data-scrolling');

      await userEvent.pointer({ keys: '[/MouseLeft]' });
    });
  });

  it('clears scrolling state on pointer cancel without releasing stale capture', async () => {
    await render(
      <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: '200px', height: '1000px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
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

    Object.defineProperties(scrollbar, {
      offsetHeight: {
        configurable: true,
        value: 200,
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
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    await fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });

    // The scrolling state lasts 500 ms. `fireEvent` resolves after the Vue flush in the same task,
    // so no timer can end the state before the next line.
    expect(scrollbar).toHaveAttribute('data-scrolling');

    await fireEvent.pointerCancel(thumb, { pointerId: 1 });

    expect(scrollbar).not.toHaveAttribute('data-scrolling');
  });

  it.skipIf(isJSDOM)(
    'ends a drag whose release was missed instead of scrolling on hover',
    async () => {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', scrollSnapType: 'y mandatory' }}
          >
            <div style={{ width: '200px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            keepMounted
            style={{ width: '10px', height: '200px' }}
          >
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      await waitFor(() => expect(thumb.offsetHeight).toBeGreaterThan(0));

      // The missed-release scenario means no capture is ever in effect.
      Object.defineProperties(thumb, {
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
        hasPointerCapture: {
          configurable: true,
          value: () => false,
        },
      });

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
      expect(viewport.scrollTop).toBeGreaterThan(0);
      const scrolled = viewport.scrollTop;

      // A different pointer hovering over the thumb must not end the active drag.
      await fireEvent.pointerMove(thumb, { clientY: 60, pointerId: 2, buttons: 0 });
      expect(viewport.scrollTop).toBe(scrolled);
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerMove(thumb, { clientY: 60, pointerId: 1, buttons: 1 });
      expect(viewport.scrollTop).toBeGreaterThan(scrolled);
      const continuedScroll = viewport.scrollTop;
      expect(thumb).toHaveAttribute('data-scrolling');

      // The release never arrived (e.g. pointer capture was lost mid-drag), so
      // the first buttonless move must end the drag rather than scroll. It must
      // clear the scrolling state immediately like a real release, not leave it
      // lingering until the scroll timeout fires.
      await fireEvent.pointerMove(thumb, { clientY: 100, pointerId: 1, buttons: 0 });
      expect(viewport.scrollTop).toBe(continuedScroll);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
      expect(thumb).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerMove(thumb, { clientY: 140, pointerId: 1, buttons: 0 });
      expect(viewport.scrollTop).toBe(continuedScroll);
    },
  );

  it('clears horizontal scrolling state on pointer cancel', async () => {
    await render(
      <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: '1000px', height: '200px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
    const thumb = screen.getByTestId('thumb');

    Object.defineProperties(viewport, {
      clientWidth: {
        configurable: true,
        value: 200,
      },
      scrollWidth: {
        configurable: true,
        value: 1000,
      },
      scrollLeft: {
        configurable: true,
        writable: true,
        value: 0,
      },
    });

    Object.defineProperties(scrollbar, {
      offsetWidth: {
        configurable: true,
        value: 200,
      },
    });

    Object.defineProperties(thumb, {
      offsetWidth: {
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
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    await fireEvent.pointerDown(thumb, { button: 0, clientX: 0, pointerId: 1 });
    await fireEvent.pointerMove(thumb, { clientX: 20, pointerId: 1, buttons: 1 });

    expect(scrollbar).toHaveAttribute('data-scrolling');

    await fireEvent.pointerCancel(thumb, { pointerId: 1 });

    expect(scrollbar).not.toHaveAttribute('data-scrolling');
  });

  describe('scroll snap', () => {
    function defineThumbPointerCapture(thumb: HTMLElement) {
      let capturedId: number | null = null;
      Object.defineProperties(thumb, {
        setPointerCapture: {
          configurable: true,
          value: (pointerId: number) => {
            capturedId = pointerId;
          },
        },
        hasPointerCapture: {
          configurable: true,
          value: (pointerId: number) => pointerId === capturedId,
        },
        releasePointerCapture: {
          configurable: true,
          value: (pointerId: number) => {
            if (pointerId === capturedId) {
              capturedId = null;
            }
          },
        },
      });
      return {
        dropCapture() {
          capturedId = null;
        },
      };
    }

    function renderWithSnap() {
      return render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', scrollSnapType: 'y mandatory' }}
          >
            <div style={{ width: '200px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );
    }

    it('disables viewport scroll snap while dragging and restores it on release', async () => {
      await renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('restores viewport scroll snap on pointer cancel', async () => {
      await renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerCancel(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores a second pointer while a drag is active', async () => {
      await renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      await fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('lets a new pointer take over when capture was silently dropped', async () => {
      await renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      const capture = defineThumbPointerCapture(thumb);

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      // The browser dropped capture without delivering `pointerup` or
      // `pointercancel`, and the contact's id never reappears (e.g. a lost
      // touch), so a new pointer must be able to take over the latched drag.
      capture.dropCapture();

      await fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      await fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores non-primary pointer presses', async () => {
      await renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      const setPointerCapture = vi.fn();
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: setPointerCapture,
      });

      await fireEvent.pointerDown(thumb, { button: 2, clientY: 0, pointerId: 1 });

      expect(viewport.style.scrollSnapType).toBe('y mandatory');
      expect(setPointerCapture).not.toHaveBeenCalled();
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

    it('adds [data-scrolling] attribute when viewport is scrolled in the correct direction', async () => {
      await renderWithFakeTimers(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="vertical" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
            <ScrollArea.Thumb data-testid="horizontal" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical');
      const horizontalThumb = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, {
        target: {
          scrollTop: 1,
        },
      });

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT - 1);
      await flushMicrotasks();

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      await fireEvent.pointerEnter(viewport);
      await fireEvent.scroll(viewport, {
        target: {
          scrollLeft: 1,
        },
      });

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      await vi.advanceTimersByTimeAsync(SCROLL_TIMEOUT - 2);
      await flushMicrotasks();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');
    });
  });

  describe('orientation of the scrollbar', () => {
    it('moves its element to the holder of the new orientation', async () => {
      const orientation = shallowRef<'vertical' | 'horizontal'>('vertical');
      const App = defineComponent(() => () => (
        <ScrollArea.Root>
          <Probe />
          <ScrollArea.Scrollbar keepMounted orientation={orientation.value}>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      await render(<App />);
      const thumb = screen.getByTestId('thumb');

      expect(rootContext.thumbYElement.value).toBe(thumb);
      expect(rootContext.thumbXElement.value).toBe(null);

      orientation.value = 'horizontal';
      await nextTick();

      expect(thumb).toHaveAttribute('data-orientation', 'horizontal');
      expect(rootContext.thumbYElement.value).toBe(null);
      expect(rootContext.thumbXElement.value).toBe(thumb);
    });

    it('clears the holder of the old orientation when the change removes the scrollbar', async () => {
      const orientation = shallowRef<'vertical' | 'horizontal'>('vertical');
      const App = defineComponent(() => () => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <Probe />
          <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '200px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation={orientation.value}>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      await render(<App />);
      await waitFor(() => expect(screen.getByTestId('thumb')).toBeInTheDocument());

      expect(rootContext.thumbYElement.value).toBe(screen.getByTestId('thumb'));

      orientation.value = 'horizontal';
      await nextTick();

      expect(screen.queryByTestId('thumb')).toBe(null);
      expect(rootContext.thumbYElement.value).toBe(null);
      expect(rootContext.thumbXElement.value).toBe(null);
    });
  });

  describe('hydration', () => {
    it('hydrates a thumb that is hidden until the first measurement', async () => {
      // The `hydrate` helper compares after two ticks. The thumb changes after the measurement, so
      // the test hydrates by hand and waits for the size.
      const serverHtml = await renderOnServer(
        'src/scroll-area/thumb/ScrollAreaThumbHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const thumb = within(container).getByTestId('thumb');
      expect(thumb).toHaveAttribute('data-orientation', 'vertical');
      expect(thumb.style.visibility).toBe('hidden');

      const hydratingApp = installPartsInterop(createSSRApp(ScrollAreaThumbHydration));
      onTestFinished(() => {
        hydratingApp.unmount();
        container.remove();
      });
      hydratingApp.mount(container);

      await waitFor(() => expect(thumb.offsetHeight).toBe(40));
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('thumb')).toBe(thumb);
      expect(takeReportedMessages()).toEqual([]);

      const clientContainer = document.createElement('div');
      document.body.append(clientContainer);
      const clientApp = installPartsInterop(createApp(ScrollAreaThumbHydration));
      onTestFinished(() => {
        clientApp.unmount();
        clientContainer.remove();
      });
      clientApp.mount(clientContainer);
      const clientThumb = within(clientContainer).getByTestId('thumb');

      await waitFor(() => expect(clientThumb.offsetHeight).toBe(40));

      expect(readAttributes(thumb)).toEqual(readAttributes(clientThumb));
    });
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Scrollbar>', async () => {
    await expect(
      render(
        <ScrollArea.Root>
          <ScrollArea.Thumb />
        </ScrollArea.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>. Without a scrollbar the thumb has no orientation. Put <ScrollArea.Thumb> inside <ScrollArea.Scrollbar>.',
    );

    expectSetupErrorWarnings(takeReportedMessages());
  });
});
