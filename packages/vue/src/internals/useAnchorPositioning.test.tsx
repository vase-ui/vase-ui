import { expect, vi, describe, beforeEach, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, KeepAlive, nextTick, shallowRef, watch } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import type { MiddlewareReturn, VirtualElement } from '@floating-ui/vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { DirectionProvider } from '../direction-provider';
import PlainPart from '../../test/fixtures/PlainPart.vue';
import PositionerPart from '../../test/fixtures/PositionerPart.vue';
import { useAnchorPositioning } from './useAnchorPositioning';
import type { OffsetFunction } from './useAnchorPositioning';
import UseAnchorPositioningHydration from './UseAnchorPositioningHydration.test.vue';

// `passSpy` gets one call for each position pass. `stopSpy` gets one call for each cleanup of
// `autoUpdate`.
const { autoUpdateSpy, stopSpy, passSpy, shiftSpy } = vi.hoisted(() => ({
  autoUpdateSpy: vi.fn(),
  stopSpy: vi.fn(),
  passSpy: vi.fn(),
  shiftSpy: vi.fn(),
}));

vi.mock('@floating-ui/vue', async () => {
  const actual = await vi.importActual<typeof import('@floating-ui/vue')>('@floating-ui/vue');

  return {
    ...actual,
    shift: ((...args: Parameters<typeof actual.shift>) => {
      shiftSpy(...args);
      return actual.shift(...args);
    }) satisfies typeof actual.shift,
    autoUpdate: ((...args: Parameters<typeof actual.autoUpdate>) => {
      autoUpdateSpy(...args);
      const stop = actual.autoUpdate(...args);
      return () => {
        stopSpy();
        stop();
      };
    }) satisfies typeof actual.autoUpdate,
    offset: ((...args: Parameters<typeof actual.offset>) => {
      const middleware = actual.offset(...args);
      return {
        ...middleware,
        fn(state) {
          passSpy();
          return middleware.fn(state);
        },
      };
    }) satisfies typeof actual.offset,
  };
});

type Part = InstanceType<typeof PlainPart>;
type Popup = InstanceType<typeof PositionerPart>;
type Place = { left: number; top: number };

const ANCHOR = { left: 200, top: 100, width: 40, height: 20 };
const POPUP = { width: 100, height: 50 };
const anchorStyle = {
  position: 'fixed',
  left: `${ANCHOR.left}px`,
  top: `${ANCHOR.top}px`,
  width: `${ANCHOR.width}px`,
  height: `${ANCHOR.height}px`,
} as const;
const popupStyle = { width: `${POPUP.width}px`, height: `${POPUP.height}px` };
const popupProps = { positionMethod: 'fixed', 'data-testid': 'popup', style: popupStyle } as const;
// The place of the popup under the anchor, centered on it.
const BELOW: Place = {
  left: ANCHOR.left + ANCHOR.width / 2 - POPUP.width / 2,
  top: ANCHOR.top + ANCHOR.height,
};
// The place of the popup beside the right edge of the anchor, centered on it.
const RIGHT: Place = {
  left: ANCHOR.left + ANCHOR.width,
  top: ANCHOR.top + ANCHOR.height / 2 - POPUP.height / 2,
};
const BEFORE_POSITION = {
  position: 'fixed',
  top: '0px',
  left: '0px',
  opacity: '0',
  '--available-width': '100vw',
  '--available-height': '100vh',
};

function createAnchor(style: Partial<CSSStyleDeclaration> = {}) {
  const anchor = document.createElement('div');
  Object.assign(anchor.style, anchorStyle, style);
  document.body.append(anchor);
  onTestFinished(() => {
    anchor.remove();
  });
  return anchor;
}

async function waitForPlace(element: Element, expected: Place) {
  await waitFor(() => {
    const { left, top } = element.getBoundingClientRect();
    expect({ left, top }).toEqual(expected);
  });
}

async function waitForPosition(popup: HTMLElement) {
  await waitFor(() => {
    expect(popup.style.opacity).toBe('');
  });
}

// A change of an option starts its position pass in a microtask. With `disableAnchorTracking`,
// no observer starts a pass, so no pass is in progress after this wait.
async function settle() {
  await waitSingleFrame();
  await waitSingleFrame();
  await flushMicrotasks();
}

type ShiftOptions =
  { crossAxis?: boolean | undefined; rootBoundary?: 'layoutViewport' | undefined } | undefined;

const TestUseAnchorPositioning = defineComponent({
  props: { shift: { type: Object as PropType<ShiftOptions>, default: undefined } },
  setup(props) {
    const anchorElement = shallowRef<HTMLDivElement | null>(null);
    const positionerElement = shallowRef<HTMLDivElement | null>(null);

    useAnchorPositioning({
      anchor: anchorElement,
      mounted: true,
      positionMethod: 'absolute',
      side: 'bottom',
      align: 'center',
      sideOffset: 0,
      alignOffset: 0,
      collisionBoundary: 'clipping-ancestors',
      collisionPadding: 5,
      sticky: false,
      arrowPadding: 5,
      disableAnchorTracking: false,
      keepMounted: false,
      collisionAvoidance: { fallbackAxisSide: 'none' },
      shift: () => props.shift,
      positionerElement,
    });

    return () => (
      <>
        <div ref={anchorElement}>anchor</div>
        <div ref={positionerElement}>floating</div>
      </>
    );
  },
});

const TestLazyFlip = defineComponent({
  props: {
    side: { type: String as PropType<'right' | 'bottom'>, default: 'right' },
    align: { type: String as PropType<'start' | 'center'>, default: 'start' },
    lazyFlip: { type: [Boolean, String] as PropType<boolean | 'placement'>, default: true },
  },
  setup(props) {
    const anchorElement = shallowRef<HTMLDivElement | null>(null);
    const positionerElement = shallowRef<HTMLDivElement | null>(null);
    const shrunk = shallowRef(false);

    const positioning = useAnchorPositioning({
      anchor: anchorElement,
      mounted: true,
      positionMethod: 'fixed',
      side: () => props.side,
      align: () => props.align,
      sideOffset: 0,
      alignOffset: 0,
      collisionBoundary: 'clipping-ancestors',
      collisionPadding: 5,
      sticky: false,
      arrowPadding: 5,
      disableAnchorTracking: false,
      keepMounted: false,
      collisionAvoidance: { fallbackAxisSide: 'none' },
      lazyFlip: () => props.lazyFlip,
      positionerElement,
    });

    return () => (
      <>
        <div
          ref={anchorElement}
          data-testid="anchor"
          style={{
            position: 'fixed',
            right: '200px',
            bottom: '30px',
            width: '20px',
            height: '20px',
          }}
        >
          anchor
        </div>
        <div
          ref={positionerElement}
          data-testid="floating"
          data-side={positioning.side.value}
          data-align={positioning.align.value}
          style={{
            ...positioning.positionerStyles.value,
            width: '100px',
            height: shrunk.value ? '10px' : '100px',
          }}
        >
          floating
        </div>
        <button
          type="button"
          onClick={() => {
            shrunk.value = true;
          }}
        >
          Shrink
        </button>
      </>
    );
  },
});

const TestLateArrow = defineComponent({
  props: {
    switchAnchor: { type: Boolean, default: false },
    anchorLeft: { type: Number, default: undefined },
  },
  setup(props) {
    const offscreenAnchor = shallowRef<HTMLDivElement | null>(null);
    const anchor = shallowRef<HTMLDivElement | null>(null);
    const positionerElement = shallowRef<HTMLDivElement | null>(null);
    const arrowMounted = shallowRef(false);

    const positioning = useAnchorPositioning({
      anchor: () =>
        props.switchAnchor && !arrowMounted.value ? offscreenAnchor.value : anchor.value,
      mounted: true,
      positionMethod: 'fixed',
      side: 'top',
      align: 'center',
      sideOffset: 0,
      alignOffset: 0,
      collisionBoundary: 'clipping-ancestors',
      collisionPadding: 5,
      sticky: false,
      arrowPadding: 5,
      // No observer starts another position pass, so only the arrow can start one.
      disableAnchorTracking: true,
      keepMounted: false,
      collisionAvoidance: { fallbackAxisSide: 'none' },
      positionerElement,
    });

    return () => (
      <>
        <div
          ref={offscreenAnchor}
          style={{
            position: 'fixed',
            left: '100px',
            top: '-1000px',
            width: '40px',
            height: '20px',
          }}
        />
        <div
          ref={anchor}
          data-testid="anchor"
          style={{
            position: 'fixed',
            left: `${props.anchorLeft ?? 100}px`,
            top: '100px',
            width: '40px',
            height: '20px',
          }}
        >
          anchor
        </div>
        <div
          ref={positionerElement}
          data-testid="floating"
          data-positioned={positioning.isPositioned.value || undefined}
          style={{ ...positioning.positionerStyles.value, width: '200px', height: '50px' }}
        >
          {arrowMounted.value && (
            <div
              ref={(element) => positioning.arrowRef(element as Element | null)}
              data-testid="arrow"
              style={{ ...positioning.arrowStyles.value, width: '10px', height: '5px' }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            arrowMounted.value = !arrowMounted.value;
          }}
        >
          Toggle arrow
        </button>
      </>
    );
  },
});

const TestCappedGrowth = defineComponent({
  setup() {
    const anchorElement = shallowRef<HTMLDivElement | null>(null);
    const positionerElement = shallowRef<HTMLDivElement | null>(null);
    const grown = shallowRef(false);

    const positioning = useAnchorPositioning({
      anchor: anchorElement,
      mounted: true,
      positionMethod: 'fixed',
      side: 'bottom',
      align: 'center',
      sideOffset: 0,
      alignOffset: 0,
      collisionBoundary: 'clipping-ancestors',
      collisionPadding: 5,
      sticky: false,
      arrowPadding: 5,
      // The test calls `update()` itself, because a flip that a `ResizeObserver` starts can log a
      // loop error that depends on timing.
      disableAnchorTracking: true,
      keepMounted: false,
      collisionAvoidance: { fallbackAxisSide: 'none' },
      positionerElement,
    });

    watch(
      grown,
      () => {
        if (grown.value) {
          positioning.update();
        }
      },
      { flush: 'post' },
    );

    return () => (
      <>
        <div
          ref={anchorElement}
          style={{ position: 'fixed', top: '60vh', left: '100px', width: '20px', height: '20px' }}
        >
          anchor
        </div>
        <div
          ref={positionerElement}
          data-testid="floating"
          data-side={positioning.side.value}
          style={{
            ...positioning.positionerStyles.value,
            width: '100px',
            maxHeight: 'var(--available-height)',
            overflowY: 'auto',
          }}
        >
          <div style={{ height: grown.value ? '200vh' : '20px' }} />
        </div>
        <button
          type="button"
          onClick={() => {
            grown.value = true;
          }}
        >
          Grow
        </button>
      </>
    );
  },
});

describe('useAnchorPositioning', () => {
  const { render } = createRenderer();

  // A pass that starts a render that starts a pass never ends, and the test then does not end.
  beforeEach(() => {
    shiftSpy.mockClear();
    passSpy.mockImplementation(() => {
      if (passSpy.mock.calls.length > 50) {
        throw new Error('One test started more than 50 position passes.');
      }
    });
  });

  it('uses the visual viewport for shift by default', async () => {
    await render(<TestUseAnchorPositioning />);

    expect(shiftSpy).toHaveBeenCalled();
    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe(undefined);
  });

  it.each([
    { shift: { rootBoundary: 'layoutViewport' } as const, crossAxis: false },
    { shift: { crossAxis: true, rootBoundary: 'layoutViewport' } as const, crossAxis: true },
  ])('uses the configured shift options', async ({ shift, crossAxis }) => {
    await render(<TestUseAnchorPositioning shift={shift} />);

    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe('layoutViewport');
    expect(shiftSpy.mock.calls[0]?.[0].crossAxis).toBe(crossAxis);
  });

  it.skipIf(isJSDOM)('locks a flipped alignment after the popup shrinks', async () => {
    // Only `'placement'` locks the alignment. `true` locks the side only, so that a Combobox can
    // still change its alignment.
    const { user } = await render(<TestLazyFlip lazyFlip="placement" />);
    const floating = screen.getByTestId('floating');

    await waitFor(() => {
      expect(floating).toHaveAttribute('data-align', 'end');
    });

    await user.click(screen.getByRole('button', { name: 'Shrink' }));

    await waitFor(() => {
      const anchorBottom = screen.getByTestId('anchor').getBoundingClientRect().bottom;
      const floatingBottom = floating.getBoundingClientRect().bottom;
      expect(Math.abs(anchorBottom - floatingBottom)).toBeLessThan(1);
    });

    expect(floating).toHaveAttribute('data-align', 'end');
  });

  it.skipIf(isJSDOM)('leaves the alignment free when lazy flipping is side-only', async () => {
    const { user } = await render(<TestLazyFlip lazyFlip />);
    const floating = screen.getByTestId('floating');

    await waitFor(() => {
      expect(floating).toHaveAttribute('data-align', 'end');
    });

    await user.click(screen.getByRole('button', { name: 'Shrink' }));

    await waitFor(() => {
      expect(floating).toHaveAttribute('data-align', 'start');
    });
  });

  it.skipIf(isJSDOM)('locks a flipped side after the popup shrinks', async () => {
    const { user } = await render(<TestLazyFlip side="bottom" align="center" />);
    const floating = screen.getByTestId('floating');

    // The anchor is at the bottom edge of the viewport, so the popup flips above it.
    await waitFor(() => {
      expect(floating).toHaveAttribute('data-side', 'top');
    });

    // The popup now fits below the anchor again, but the side is locked.
    await user.click(screen.getByRole('button', { name: 'Shrink' }));

    await waitFor(() => {
      const anchorTop = screen.getByTestId('anchor').getBoundingClientRect().top;
      const floatingBottom = floating.getBoundingClientRect().bottom;
      expect(Math.abs(anchorTop - floatingBottom)).toBeLessThan(1);
    });

    expect(floating).toHaveAttribute('data-side', 'top');
  });

  it.skipIf(isJSDOM)('flips back to the preferred side without lazy flipping', async () => {
    const { user } = await render(<TestLazyFlip side="bottom" align="center" lazyFlip={false} />);
    const floating = screen.getByTestId('floating');

    await waitFor(() => {
      expect(floating).toHaveAttribute('data-side', 'top');
    });

    await user.click(screen.getByRole('button', { name: 'Shrink' }));

    await waitFor(() => {
      expect(floating).toHaveAttribute('data-side', 'bottom');
    });
  });

  it.skipIf(isJSDOM)('centers an arrow that mounts after the popup is positioned', async () => {
    const { user } = await render(<TestLateArrow />);

    await waitFor(() => {
      expect(screen.getByTestId('floating')).toHaveAttribute('data-positioned');
    });

    await user.click(screen.getByRole('button', { name: 'Toggle arrow' }));

    const anchorRect = screen.getByTestId('anchor').getBoundingClientRect();
    const anchorCenter = anchorRect.left + anchorRect.width / 2;

    await waitFor(() => {
      const arrowRect = screen.getByTestId('arrow').getBoundingClientRect();
      expect(arrowRect.left + arrowRect.width / 2).toBeCloseTo(anchorCenter, 0);
    });
  });

  it.skipIf(isJSDOM)(
    'positions against the new anchor when the arrow mounts as the anchor changes',
    async () => {
      const { user } = await render(<TestLateArrow switchAnchor />);
      const floating = screen.getByTestId('floating');

      await waitFor(() => {
        expect(floating).toHaveAttribute('data-positioned');
      });
      expect(floating.getBoundingClientRect().bottom).toBeLessThan(0);

      await user.click(screen.getByRole('button', { name: 'Toggle arrow' }));

      const anchorTop = screen.getByTestId('anchor').getBoundingClientRect().top;
      await waitFor(() => {
        expect(floating.getBoundingClientRect().bottom).toBeCloseTo(anchorTop, 0);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'repositions when the arrow unmounts after the popup is positioned',
    async () => {
      // The right edge of the anchor is at 5px. While the arrow is mounted, the shift limit of the
      // arrow holds the popup at -5px. Without the arrow, the collision padding moves the popup
      // to 5px.
      const { user } = await render(<TestLateArrow anchorLeft={-35} />);
      const floating = screen.getByTestId('floating');
      const toggle = screen.getByRole('button', { name: 'Toggle arrow' });

      await waitFor(() => {
        expect(floating).toHaveAttribute('data-positioned');
      });

      await user.click(toggle);
      await waitFor(() => {
        expect(floating.getBoundingClientRect().left).toBeCloseTo(-5, 0);
      });

      await user.click(toggle);
      expect(screen.queryByTestId('arrow')).toBe(null);
      await waitFor(() => {
        expect(floating.getBoundingClientRect().left).toBeCloseTo(5, 0);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'flips a capped popup to the larger side when it grows while open',
    async () => {
      const { user } = await render(<TestCappedGrowth />);
      const floating = screen.getByTestId('floating');

      await waitFor(() => {
        expect(floating).toHaveAttribute('data-side', 'bottom');
      });

      // The content fits on neither side, and there is more space above the anchor.
      await user.click(screen.getByRole('button', { name: 'Grow' }));

      await waitFor(() => {
        expect(floating).toHaveAttribute('data-side', 'top');
      });
    },
  );

  // Renders the fixture positioner against a trigger. A write of `props` renders it again.
  async function renderPopup(initialProps: Record<string, unknown> = {}) {
    const trigger = createAnchor();
    const props = shallowRef(initialProps);
    const part = shallowRef<Popup | null>(null);
    const view = await render(() => (
      <PositionerPart ref={part} trigger={trigger} {...popupProps} {...props.value} />
    ));
    return { trigger, props, part, view, popup: screen.getByTestId('popup') };
  }

  describe('anchor', () => {
    const virtualElement: VirtualElement = {
      getBoundingClientRect: () =>
        new DOMRect(ANCHOR.left, ANCHOR.top, ANCHOR.width, ANCHOR.height),
    };

    it.each([
      {
        name: 'an element',
        props: (part: ShallowRef<Part | null>) => ({ anchor: part.value?.element }),
      },
      { name: 'a virtual element', props: () => ({ anchor: virtualElement }) },
      { name: 'a component', props: (part: ShallowRef<Part | null>) => ({ anchor: part.value }) },
      { name: 'a ref', props: (part: ShallowRef<Part | null>) => ({ anchor: part }) },
      {
        name: 'a getter',
        props: (part: ShallowRef<Part | null>) => ({ anchor: () => part.value }),
      },
      {
        name: 'the trigger of the root',
        props: (part: ShallowRef<Part | null>) => ({ trigger: part.value?.element }),
      },
    ])('positions the popup against $name', async ({ props }) => {
      const part = shallowRef<Part | null>(null);
      await render(() => (
        <>
          <PlainPart ref={part} style={anchorStyle} />
          <PositionerPart {...popupProps} {...props(part)} />
        </>
      ));

      await waitForPlace(screen.getByTestId('popup'), BELOW);
    });

    it('calls a getter only when the DOM of the render exists', async () => {
      const open = shallowRef(true);
      const anchor = vi.fn(() => document.querySelector('[data-testid="late-anchor"]'));
      await render(() => (
        <>
          <PositionerPart anchor={anchor} mounted={open.value} keepMounted {...popupProps} />
          {open.value && <div data-testid="late-anchor" style={anchorStyle} />}
        </>
      ));
      const popup = screen.getByTestId('popup');
      await waitForPlace(popup, BELOW);
      expect(anchor.mock.results[0]?.value).toBe(screen.getByTestId('late-anchor'));

      open.value = false;
      await settle();
      expect(screen.queryByTestId('late-anchor')).toBe(null);
      open.value = true;

      await waitForPlace(popup, BELOW);
    });

    it('calls a getter only while the popup is mounted', async () => {
      const open = shallowRef(false);
      const trigger = createAnchor();
      const anchor = vi.fn(() => trigger);
      await render(() => (
        <PositionerPart anchor={anchor} mounted={open.value} keepMounted {...popupProps} />
      ));
      const popup = screen.getByTestId('popup');
      await settle();
      expect(anchor).not.toHaveBeenCalled();

      open.value = true;
      await waitForPlace(popup, BELOW);
      await settle();
      expect(anchor).toHaveBeenCalled();
      const callsWhileOpen = anchor.mock.calls.length;

      open.value = false;
      await settle();
      expect(anchor).toHaveBeenCalledTimes(callsWhileOpen);
    });

    it('moves to a new anchor while the popup is open, and back to the trigger', async () => {
      const other = createAnchor({ left: '50px', top: '300px' });
      const { props, popup } = await renderPopup();
      await waitForPlace(popup, BELOW);

      props.value = { anchor: other };
      await waitForPlace(popup, {
        left: 50 + ANCHOR.width / 2 - POPUP.width / 2,
        top: 300 + ANCHOR.height,
      });

      props.value = { anchor: null };
      await waitForPlace(popup, BELOW);
    });

    it('reports an anchor that is outside the viewport', async () => {
      const { trigger, popup } = await renderPopup();
      await waitForPlace(popup, BELOW);
      expect(popup).not.toHaveAttribute('data-anchor-hidden');

      trigger.style.top = '-200px';

      await waitFor(() => {
        expect(popup).toHaveAttribute('data-anchor-hidden');
      });
    });
  });

  describe('options', () => {
    it.each<{
      name: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      rtl?: boolean;
      expected: Place;
    }>([
      { name: 'side', before: {}, after: { side: 'right' }, expected: RIGHT },
      {
        name: 'align',
        before: {},
        after: { align: 'start' },
        expected: { left: ANCHOR.left, top: BELOW.top },
      },
      {
        name: 'sideOffset',
        before: {},
        after: { sideOffset: 10 },
        expected: { left: BELOW.left, top: BELOW.top + 10 },
      },
      {
        name: 'alignOffset',
        before: { align: 'start' },
        after: { align: 'start', alignOffset: 7 },
        expected: { left: ANCHOR.left + 7, top: BELOW.top },
      },
      {
        name: 'the direction',
        before: { side: 'inline-start' },
        after: { side: 'inline-start' },
        rtl: true,
        expected: RIGHT,
      },
    ])(
      'computes a new position when $name changes',
      async ({ before, after, expected, rtl = false }) => {
        const trigger = createAnchor();
        const props = shallowRef(before);
        const direction = shallowRef<'ltr' | 'rtl'>('ltr');
        await render(() => (
          <DirectionProvider direction={direction.value}>
            <PositionerPart
              trigger={trigger}
              disableAnchorTracking
              {...popupProps}
              {...props.value}
            />
          </DirectionProvider>
        ));
        const popup = screen.getByTestId('popup');
        await waitForPosition(popup);
        await settle();

        props.value = after;
        direction.value = rtl ? 'rtl' : 'ltr';

        await waitForPlace(popup, expected);
      },
    );

    it('gives the sizes of the anchor and the positioner to an offset function', async () => {
      const sideOffset: OffsetFunction = ({ anchor }) => anchor.height;
      const alignOffset: OffsetFunction = ({ positioner }) => positioner.width / 10;
      const { popup } = await renderPopup({ align: 'start', sideOffset, alignOffset });

      await waitForPlace(popup, {
        left: ANCHOR.left + POPUP.width / 10,
        top: BELOW.top + ANCHOR.height,
      });
    });

    it('does not accept an offset function with a parameter in place of a getter', () => {
      const params = (sideOffset: OffsetFunction) =>
        ({
          mounted: true,
          collisionAvoidance: {},
          positionerElement: null,
          // @ts-expect-error `toValue` calls a function, so the getter must return the function.
          sideOffset,
        }) satisfies Parameters<typeof useAnchorPositioning>[0];

      expect(params).toBeTypeOf('function');
    });

    it('computes one position, from the last options, when two options change in one render', async () => {
      // `align: 'start'` overflows the right edge. With the old `collisionAvoidance`, the popup
      // flips to `end`. With the new one, it stays at `start`.
      const { trigger, props, popup } = await renderPopup({ disableAnchorTracking: true });
      trigger.style.left = 'calc(100vw - 60px)';
      await waitForPosition(popup);
      await settle();
      passSpy.mockClear();

      props.value = {
        disableAnchorTracking: true,
        align: 'start',
        collisionAvoidance: { align: 'none' },
      };
      await settle();

      expect(passSpy).toHaveBeenCalledTimes(1);
      expect(popup).toHaveAttribute('data-align', 'start');
      expect(popup.getBoundingClientRect().left).toBe(trigger.getBoundingClientRect().left);
    });

    it.each([
      { name: 'a list of elements', boundary: (element: Element) => [element] },
      { name: 'a rectangle', boundary: () => ({ x: 0, y: 0, width: 400, height: 400 }) },
    ])(
      'computes no position when a new render gives equal objects, with $name as the boundary',
      async ({ boundary }) => {
        const element = createAnchor({ left: '0px', top: '0px', width: '400px', height: '400px' });
        const options = () => ({
          disableAnchorTracking: true,
          collisionPadding: { top: 5, right: 5, bottom: 5, left: 5 },
          collisionAvoidance: { side: 'flip', align: 'flip' },
          collisionBoundary: boundary(element),
        });
        const { props, popup } = await renderPopup(options());
        await waitForPlace(popup, BELOW);
        await settle();
        passSpy.mockClear();

        props.value = options();
        await settle();
        expect(passSpy).not.toHaveBeenCalled();

        props.value = { ...options(), collisionPadding: { top: 5, right: 5, bottom: 5, left: 6 } };
        await settle();
        expect(passSpy).toHaveBeenCalledTimes(1);
      },
    );

    // The ref of a component with no `expose` also gives its props. These props have the names and
    // the types of a rectangle, and their values are not the pixels of the element.
    const BoxWithRectangleProps = defineComponent({
      props: {
        x: { type: Number, default: 1 },
        y: { type: Number, default: 2 },
        width: { type: Number, default: 3 },
        height: { type: Number, default: 4 },
      },
      setup: () => () => <div />,
    });

    it.each([
      { name: 'an element', boundary: (part: Part | null) => part?.element },
      { name: 'a component', boundary: (part: Part | null) => part },
      {
        name: 'a component with width and height props',
        Box: BoxWithRectangleProps,
        boundary: (part: Part | null) => part,
      },
      {
        name: 'a list of elements',
        boundary: (part: Part | null) => (part?.element ? [part.element] : []),
      },
      { name: 'a getter', boundary: (part: Part | null) => () => part },
      { name: 'a rectangle', boundary: () => ({ x: 150, y: 0, width: 120, height: 400 }) },
    ])('keeps the popup in a collision boundary that is $name', async ({ Box, boundary }) => {
      const trigger = createAnchor();
      const part = shallowRef<Part | null>(null);
      const BoundaryBox = Box ?? PlainPart;
      await render(() => (
        <>
          <BoundaryBox
            ref={part}
            style={{
              position: 'fixed',
              left: '150px',
              top: '0px',
              width: '120px',
              height: '400px',
            }}
          />
          <PositionerPart
            trigger={trigger}
            collisionBoundary={boundary(part.value)}
            {...popupProps}
          />
        </>
      ));

      // The right edge of the boundary is at 270 px, and the default `collisionPadding` is 5 px.
      await waitForPlace(screen.getByTestId('popup'), {
        left: 270 - 5 - POPUP.width,
        top: BELOW.top,
      });
    });
  });

  describe('available size', () => {
    const availableHeight = (popup: HTMLElement) =>
      popup.style.getPropertyValue('--available-height');
    const heightBelow = () => `${document.documentElement.clientHeight - BELOW.top - 5}px`;

    it('keeps the available size of the last position after a later render', async () => {
      const { props, popup } = await renderPopup({ disableAnchorTracking: true });
      await waitFor(() => {
        expect(availableHeight(popup)).toBe(heightBelow());
      });
      await settle();

      props.value = { disableAnchorTracking: true, 'data-render': 1 };
      await settle();

      expect(popup).toHaveAttribute('data-render', '1');
      expect(availableHeight(popup)).toBe(heightBelow());
      expect(popup.style.getPropertyValue('--anchor-width')).toBe(`${ANCHOR.width}px`);
    });

    it('writes the available size on a positioner that does not render the positioner styles', async () => {
      const trigger = createAnchor();
      const Test = defineComponent(() => {
        const positionerElement = shallowRef<HTMLDivElement | null>(null);
        useAnchorPositioning({
          mounted: true,
          collisionAvoidance: {},
          positionerElement,
          defaultAnchor: trigger,
        });
        return () => (
          <div ref={positionerElement} data-testid="popup" style={{ position: 'fixed' }} />
        );
      });
      await render(<Test />);
      const popup = screen.getByTestId('popup');

      await waitFor(() => {
        expect(availableHeight(popup)).toBe(heightBelow());
      });
    });

    it('ignores a position pass that ends after the popup closed', async () => {
      const kept = { keepMounted: true, disableAnchorTracking: true };
      const { trigger, props, part, popup } = await renderPopup({ mounted: true, ...kept });
      await waitForPlace(popup, BELOW);
      await settle();

      trigger.style.top = '300px';
      part.value!.update();
      props.value = { mounted: false, ...kept };
      await settle();

      expect(availableHeight(popup)).toBe(heightBelow());
      expect(popup.style.opacity).toBe('0');
      expect(popup.style.transform).toBe('');

      // The position of the old pass must not show when the popup opens again.
      props.value = { mounted: true, ...kept };
      await nextTick();
      expect(popup.style.opacity).toBe('0');
      expect(popup.style.transform).toBe('');
      await waitForPlace(popup, { left: BELOW.left, top: 300 + ANCHOR.height });
    });
  });

  describe('arrow', () => {
    const count = shallowRef(0);
    const ARROW = { width: 10, height: 5 };

    async function renderWithArrow(showArrow = shallowRef(true)) {
      const trigger = createAnchor();
      const Test = defineComponent(() => {
        const positionerElement = shallowRef<HTMLDivElement | null>(null);
        const positioning = useAnchorPositioning({
          mounted: true,
          positionMethod: 'fixed',
          disableAnchorTracking: true,
          collisionAvoidance: { fallbackAxisSide: 'none' },
          positionerElement,
          defaultAnchor: trigger,
        });
        return () => (
          <div
            ref={positionerElement}
            data-testid="popup"
            data-render={count.value}
            style={{ ...positioning.positionerStyles.value, ...popupStyle }}
          >
            {showArrow.value && (
              <div
                ref={(element) => positioning.arrowRef(element as Element | null)}
                data-testid="arrow"
                style={{
                  ...positioning.arrowStyles.value,
                  width: `${ARROW.width}px`,
                  height: `${ARROW.height}px`,
                }}
              />
            )}
          </div>
        );
      });
      await render(<Test />);
      const popup = screen.getByTestId('popup');
      await waitForPlace(popup, BELOW);
      await settle();
      return popup;
    }

    it('computes one position when the arrow mounts after the first position', async () => {
      const showArrow = shallowRef(false);
      await renderWithArrow(showArrow);
      passSpy.mockClear();

      showArrow.value = true;
      await settle();

      expect(screen.getByTestId('arrow')).toBeInTheDocument();
      expect(passSpy).toHaveBeenCalledTimes(1);
    });

    it('centers an arrow that mounts just before the first position ends', async () => {
      const trigger = createAnchor();
      const showArrow = shallowRef(false);
      // The last middleware holds the first position pass at a gate, after the arrow middleware
      // used the fake arrow.
      let openGate!: (data: MiddlewareReturn) => void;
      const gate = new Promise<MiddlewareReturn>((resolve) => {
        openGate = resolve;
      });
      let reachGate!: () => void;
      const reached = new Promise<void>((resolve) => {
        reachGate = resolve;
      });
      const Test = defineComponent(() => {
        const positionerElement = shallowRef<HTMLDivElement | null>(null);
        const positioning = useAnchorPositioning({
          mounted: true,
          positionMethod: 'fixed',
          disableAnchorTracking: true,
          collisionAvoidance: { fallbackAxisSide: 'none' },
          positionerElement,
          defaultAnchor: trigger,
          adaptiveOrigin: {
            name: 'gate',
            fn() {
              reachGate();
              return gate;
            },
          },
        });
        return () => (
          <div
            ref={positionerElement}
            style={{ ...positioning.positionerStyles.value, ...popupStyle }}
          >
            {showArrow.value && (
              <div
                ref={(element) => positioning.arrowRef(element as Element | null)}
                data-testid="arrow"
                style={{
                  ...positioning.arrowStyles.value,
                  width: `${ARROW.width}px`,
                  height: `${ARROW.height}px`,
                }}
              />
            )}
          </div>
        );
      });
      await render(<Test />);
      await reached;
      // No flush is pending when the gate opens.
      await flushMicrotasks();

      // The first position is written in the second microtask after the gate opens. The flush that
      // mounts the arrow runs between the first and the second microtask. The microtask of
      // `arrowRef` then runs after the write of the position and before the next flush. It must
      // find `isPositioned` set. If it does not, the arrow keeps the position of the first pass,
      // which used no arrow.
      openGate({});
      showArrow.value = true;

      await waitFor(() => {
        expect(screen.getByTestId('arrow').getBoundingClientRect().left).toBe(
          ANCHOR.left + ANCHOR.width / 2 - ARROW.width / 2,
        );
      });
      expect(passSpy).toHaveBeenCalledTimes(2);
    });

    it('computes no position when a render gives the same arrow element', async () => {
      const popup = await renderWithArrow();
      passSpy.mockClear();

      count.value += 1;
      await settle();

      expect(popup).toHaveAttribute('data-render', `${count.value}`);
      expect(passSpy).not.toHaveBeenCalled();
    });
  });

  describe('prop: keepMounted', () => {
    it('does no position work while the popup is not mounted', async () => {
      const { props, popup, view } = await renderPopup({ mounted: false, keepMounted: true });
      await settle();
      expect(autoUpdateSpy).not.toHaveBeenCalled();
      expect(passSpy).not.toHaveBeenCalled();
      expect(popup).toHaveStyle(BEFORE_POSITION);

      props.value = { mounted: true, keepMounted: true };
      await waitForPlace(popup, BELOW);
      expect(autoUpdateSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();

      passSpy.mockClear();
      props.value = { mounted: false, keepMounted: true };
      await settle();
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(passSpy).not.toHaveBeenCalled();
      expect(popup).toHaveStyle({ position: 'fixed', top: '0px', left: '0px', opacity: '0' });

      props.value = { mounted: true, keepMounted: true };
      await waitForPlace(popup, BELOW);
      await settle();
      passSpy.mockClear();
      view.unmount();
      await settle();
      expect(stopSpy).toHaveBeenCalledTimes(2);
      expect(passSpy).not.toHaveBeenCalled();
    });

    it('releases a locked side when the popup is not mounted', async () => {
      const mounted = shallowRef(true);
      const height = shallowRef(100);
      const trigger = createAnchor({ top: 'auto', bottom: '30px' });
      const Test = defineComponent(() => {
        const positionerElement = shallowRef<HTMLDivElement | null>(null);
        const positioning = useAnchorPositioning({
          mounted,
          keepMounted: true,
          positionMethod: 'fixed',
          collisionAvoidance: { fallbackAxisSide: 'none' },
          lazyFlip: true,
          positionerElement,
          defaultAnchor: trigger,
        });
        return () => (
          <div
            ref={positionerElement}
            data-testid="popup"
            hidden={!mounted.value}
            data-side={positioning.side.value}
            style={{
              ...positioning.positionerStyles.value,
              width: '100px',
              height: `${height.value}px`,
            }}
          />
        );
      });
      await render(<Test />);
      const popup = screen.getByTestId('popup');
      await waitFor(() => {
        expect(popup).toHaveAttribute('data-side', 'top');
      });
      // The popup now fits below the anchor, but the side is locked.
      height.value = 10;
      await settle();
      expect(popup).toHaveAttribute('data-side', 'top');

      mounted.value = false;
      await settle();
      mounted.value = true;

      await waitFor(() => {
        expect(popup).toHaveAttribute('data-side', 'bottom');
      });
    });
  });

  describe('prop: disableAnchorTracking', () => {
    it('starts `autoUpdate` again when the prop changes while the popup is mounted', async () => {
      const { props, popup } = await renderPopup({ disableAnchorTracking: true });
      await waitForPlace(popup, BELOW);
      expect(autoUpdateSpy.mock.lastCall?.[3]).toEqual({
        ancestorScroll: false,
        elementResize: false,
        layoutShift: false,
      });

      props.value = { disableAnchorTracking: false };
      await flushMicrotasks();

      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(autoUpdateSpy).toHaveBeenCalledTimes(2);
      expect(autoUpdateSpy.mock.lastCall?.[3]).toEqual({
        ancestorScroll: true,
        elementResize: true,
        layoutShift: true,
      });
    });

    it('does not start `autoUpdate` when the prop changes while the popup is closed', async () => {
      const kept = { keepMounted: true };
      const { props, popup } = await renderPopup({
        mounted: true,
        disableAnchorTracking: true,
        ...kept,
      });
      await waitForPlace(popup, BELOW);

      props.value = { mounted: false, disableAnchorTracking: true, ...kept };
      await settle();
      const callsWhileOpen = autoUpdateSpy.mock.calls.length;

      props.value = { mounted: false, disableAnchorTracking: false, ...kept };
      await settle();

      expect(autoUpdateSpy).toHaveBeenCalledTimes(callsWhileOpen);
    });
  });

  describe('KeepAlive', () => {
    it('stops `autoUpdate` on deactivation and starts it again on activation', async () => {
      const trigger = createAnchor();
      const visible = shallowRef(true);
      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <PositionerPart key="popup" trigger={trigger} {...popupProps} />
          ) : (
            <span key="other" />
          )}
        </KeepAlive>
      ));
      const popup = screen.getByTestId('popup');
      await waitForPlace(popup, BELOW);
      expect(stopSpy).not.toHaveBeenCalled();

      visible.value = false;
      await flushMicrotasks();
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(autoUpdateSpy).toHaveBeenCalledTimes(1);

      trigger.style.left = '60px';
      visible.value = true;

      await waitForPlace(popup, { left: 60 + ANCHOR.width / 2 - POPUP.width / 2, top: BELOW.top });
      expect(autoUpdateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('hydration', () => {
    const file = 'src/internals/UseAnchorPositioningHydration.test.vue';

    it('hydrates a popup that is kept mounted and closed', async () => {
      const props = { mounted: false, keepMounted: true };
      const serverHtml = await renderOnServer(file, props);

      const { container } = await hydrate(UseAnchorPositioningHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="popup"]')).toHaveStyle(BEFORE_POSITION);
    });

    it('hydrates an open popup and then gives it a position', async () => {
      // The position comes after the two ticks of the `hydrate` helper, so the test hydrates by
      // hand and waits for the position.
      const props = { mounted: true };
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = await renderOnServer(file, props);
      const popup = container.querySelector('[data-testid="popup"]')!;
      expect(popup).toHaveStyle(BEFORE_POSITION);

      const app = createSSRApp(UseAnchorPositioningHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitForPlace(popup, BELOW);
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(container.querySelector('[data-testid="popup"]')).toBe(popup);
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
