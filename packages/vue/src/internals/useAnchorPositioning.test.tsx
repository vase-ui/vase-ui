import { expect, vi, describe, beforeEach, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import type { VirtualElement } from '@floating-ui/vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
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
const { autoUpdateSpy, stopSpy, passSpy } = vi.hoisted(() => ({
  autoUpdateSpy: vi.fn(),
  stopSpy: vi.fn(),
  passSpy: vi.fn(),
}));

vi.mock('@floating-ui/vue', async () => {
  const actual = await vi.importActual<typeof import('@floating-ui/vue')>('@floating-ui/vue');

  return {
    ...actual,
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

describe('useAnchorPositioning', () => {
  const { render } = createRenderer();

  // A pass that starts a render that starts a pass never ends, and the test then does not end.
  beforeEach(() => {
    passSpy.mockImplementation(() => {
      if (passSpy.mock.calls.length > 50) {
        throw new Error('One test started more than 50 position passes.');
      }
    });
  });

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
        name: 'a component that has width and height props',
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

    it('puts the arrow at the center of the anchor', async () => {
      await renderWithArrow();

      expect(screen.getByTestId('arrow').getBoundingClientRect().left).toBe(
        ANCHOR.left + ANCHOR.width / 2 - ARROW.width / 2,
      );
    });

    it('computes one position when the arrow mounts after the first position', async () => {
      const showArrow = shallowRef(false);
      await renderWithArrow(showArrow);
      passSpy.mockClear();

      showArrow.value = true;
      await settle();

      expect(screen.getByTestId('arrow')).toBeInTheDocument();
      expect(passSpy).toHaveBeenCalledTimes(1);
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
