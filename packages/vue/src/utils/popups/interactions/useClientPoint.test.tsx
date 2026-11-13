import { describe, expect, it, onTestFinished, test, vi } from 'vitest';
import { KeepAlive, Teleport, computed, defineComponent, inject, shallowRef } from 'vue';
import type { MaybeRefOrGetter, PropType } from 'vue';
import type { Coords } from '@floating-ui/vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  useTestInteractions,
  waitFor,
} from '#test-utils';
import { PopupFixtureContext } from '../../../../test/fixtures/PopupFixture';
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupPositionerPart from '../../../../test/fixtures/PopupPositionerPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../../test/fixtures/PopupTriggerPart.vue';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { useClientPoint } from './useClientPoint';

const { render } = createRenderer();

function expectLocation({ x, y }: Coords) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(0);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(0);
}

function expectRect({ x, y, width, height }: DOMRectInit) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(width);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(height);
}

function createRootStore(referenceElement: HTMLElement) {
  return new FloatingRootStore({
    open: false,
    anchorElement: referenceElement,
    positionerElement: document.createElement('div'),
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

const App = defineComponent({
  props: {
    enabled: { type: Boolean, default: true },
    axis: { type: String as PropType<'both' | 'x' | 'y'>, default: undefined },
    useTriggerProps: { type: Boolean, default: false },
    openWithFocusEvent: { type: Boolean, default: false },
  },
  setup(props) {
    const isOpen = shallowRef(false);
    const { refs, context } = useFloating({
      open: isOpen,
      onOpenChange(nextOpen) {
        isOpen.value = nextOpen;
      },
    });
    const clientPoint = useClientPoint(context.rootStore, {
      enabled: () => props.enabled,
      axis: () => props.axis,
    });
    // The composable returns one object of listeners. Base UI gives the same listeners as `reference`
    // and as `trigger`.
    const { getReferenceProps, getTriggerProps, getFloatingProps } = useTestInteractions([
      { reference: clientPoint, trigger: clientPoint },
    ]);

    function handleButtonClick() {
      if (!props.openWithFocusEvent) {
        isOpen.value = !isOpen.value;
        return;
      }

      context.rootStore.setOpen(
        true,
        createChangeEventDetails(
          REASONS.triggerFocus,
          new FocusEvent('focus'),
          refs.reference.value as HTMLElement,
        ),
      );
    }

    return () => {
      // The `useFloating` of the fixture has no `elements`. The reference of Base UI is the anchor
      // of the store, which is the virtual element of the cursor or else the trigger.
      const rect = context.rootStore.select('anchor')?.getBoundingClientRect();
      const referenceProps = props.useTriggerProps ? getTriggerProps() : getReferenceProps();

      return (
        <>
          <div
            data-testid="reference"
            ref={refs.setReference}
            {...referenceProps}
            style={{ width: 0, height: 0, pointerEvents: 'none' }}
          >
            Reference
          </div>
          {isOpen.value && (
            <div
              data-testid="floating"
              ref={refs.setFloating}
              {...getFloatingProps()}
              style={{ pointerEvents: 'none' }}
            >
              Floating
            </div>
          )}
          <button onClick={handleButtonClick} />
          <span data-testid="x">{rect?.x}</span>
          <span data-testid="y">{rect?.y}</span>
          <span data-testid="width">{rect?.width}</span>
          <span data-testid="height">{rect?.height}</span>
        </>
      );
    };
  },
});

test('updates position from trigger props', async () => {
  await render(<App useTriggerProps />);

  await flushMicrotasks();

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 400,
      clientY: 200,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 400, y: 200 });
});

test('uses trigger element when dom reference is missing', async () => {
  await render(<App axis="x" />);

  const reference = screen.getByTestId('reference');
  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 50,
    width: 0,
    height: 0,
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    toJSON: () => {},
  });

  await flushMicrotasks();

  await fireEvent.mouseMove(reference, {
    clientX: 200,
    clientY: 300,
  });

  await flushMicrotasks();

  expectLocation({ x: 200, y: 50 });
});

test('renders at mouse event coords', async () => {
  await render(<App />);

  await flushMicrotasks();

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 1000,
      clientY: 1000,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 1000, y: 1000 });

  // Window listener isn't registered unless the floating element is open.
  await fireEvent(
    window,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 1000, y: 1000 });

  await fireEvent.click(screen.getByRole('button'));
  await flushMicrotasks();

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 700, y: 700 });

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 0, y: 0 });
});

test('cleans up window listener when closing or disabling', async () => {
  const { setProps } = await render(<App />);

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  await setProps({ enabled: false });

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectRect({ x: 0, y: 0, width: 0, height: 0 });
});

test('clears virtual references on unmount without retaining a stale DOM reference', async () => {
  const reference = document.createElement('button');
  const store = createRootStore(reference);
  const virtualReference = {
    getBoundingClientRect: () => reference.getBoundingClientRect(),
  };

  store.set('anchorOverride', virtualReference);

  const ClientPointStoreTest = defineComponent({
    props: { enabled: { type: Boolean, default: true } },
    setup(props) {
      useClientPoint(store, { enabled: () => props.enabled });
      return () => null;
    },
  });

  const { setProps, unmount } = await render(<ClientPointStoreTest />);

  await setProps({ enabled: false });
  await flushMicrotasks();

  expect(store.state.anchorOverride).toBe(reference);

  store.set('anchorOverride', virtualReference);
  unmount();

  expect(store.state.anchorOverride).toBe(null);
});

test('axis x', async () => {
  await render(<App axis="x" />);

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 0 });
});

test('axis y', async () => {
  await render(<App axis="y" />);

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 0, y: 500 });
});

test.for([
  {
    axis: 'x',
    atCursor: { x: 500, y: 20, width: 0, height: 40 },
    afterReferenceMoves: { x: 550, y: 70, width: 0, height: 40 },
  },
  {
    axis: 'y',
    atCursor: { x: 10, y: 500, width: 30, height: 0 },
    afterReferenceMoves: { x: 60, y: 550, width: 30, height: 0 },
  },
] as const)(
  'keeps the reference size on the untracked axis when tracking $axis',
  async ({ axis, atCursor, afterReferenceMoves }) => {
    await render(<App axis={axis} />);

    const reference = screen.getByTestId('reference');
    let referenceRect = { x: 10, y: 20, width: 30, height: 40 };

    reference.getBoundingClientRect = () => {
      const { x, y, width, height } = referenceRect;
      return {
        x,
        y,
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        toJSON: () => {},
      };
    };

    await fireEvent(
      reference,
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 500,
        clientY: 500,
      }),
    );
    await flushMicrotasks();

    expectRect(atCursor);

    // Opening re-reads the same virtual element as an auto-update. The open wasn't a hover,
    // so the cursor point keeps its offset from the reference instead of snapping back.
    referenceRect = { x: 60, y: 70, width: 30, height: 40 };

    await fireEvent.click(screen.getByRole('button'));
    await flushMicrotasks();

    expectRect(afterReferenceMoves);
  },
);

test('removes window listener when cursor lands on floating element', async () => {
  await render(<App />);

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );

  expectLocation({ x: 500, y: 500 });
});

test('reattaches window listener after cursor returns from floating element to reference', async () => {
  await render(<App />);

  await fireEvent.click(screen.getByRole('button'));

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );

  expectLocation({ x: 500, y: 500 });

  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );
  await flushMicrotasks();

  // Reapply deterministic coordinates after the effect attaches the window listener.
  // A real browser cursor can emit an unrelated move while the effect is flushing.
  await fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );

  expectLocation({ x: 600, y: 700 });

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );

  await flushMicrotasks();
  expectLocation({ x: 100, y: 200 });
});

test('restores the DOM reference when opened by a non-mouse event', async () => {
  await render(<App openWithFocusEvent />);

  const reference = screen.getByTestId('reference');

  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    top: 20,
    right: 40,
    bottom: 60,
    left: 10,
    toJSON: () => {},
  });

  await fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  await fireEvent.click(screen.getByRole('button'));
  await flushMicrotasks();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });

  await fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );

  await fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 300,
      clientY: 400,
    }),
  );
  await flushMicrotasks();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });
});

describe('rules with no Base UI case', () => {
  const REFERENCE_RECT = { x: 10, y: 20, width: 30, height: 40 };

  // A reference that the cases can move. The browser has no layout for it, so the rect is a record.
  function createReferenceRect() {
    const rect = { ...REFERENCE_RECT };
    return {
      rect,
      getBoundingClientRect: () => {
        const { x, y, width, height } = rect;
        return {
          x,
          y,
          width,
          height,
          top: y,
          right: x + width,
          bottom: y + height,
          left: x,
          toJSON: () => {},
        };
      },
    };
  }

  // A part that follows the cursor. The fixture `useFloating` returns no `elements`, so a case
  // reads the anchor of the store, which is `elements.reference` of Base UI. `keepMounted` keeps
  // the floating element while the popup is closed, as a popup does during its exit transition.
  // With `container`, the floating element is in that element, such as the body of a frame.
  function createFollower(
    options: {
      enabled?: MaybeRefOrGetter<boolean | undefined>;
      axis?: MaybeRefOrGetter<'x' | 'y' | 'both' | undefined>;
      keepMounted?: boolean;
      container?: Element;
    } = {},
  ) {
    const open = shallowRef(false);
    const reference = createReferenceRect();
    let store!: FloatingRootStore;

    const Follower = defineComponent({
      setup() {
        const floating = useFloating({
          open,
          onOpenChange(nextOpen) {
            open.value = nextOpen;
          },
        });
        store = floating.context.rootStore;
        const clientPoint = useClientPoint(store, {
          enabled: options.enabled,
          axis: options.axis,
        });

        return () => (
          <>
            <div
              data-testid="reference"
              ref={(element) => {
                if (element) {
                  (element as HTMLElement).getBoundingClientRect = reference.getBoundingClientRect;
                }
                floating.refs.setReference(element);
              }}
              {...clientPoint}
              style={{ pointerEvents: 'none' }}
            />
            {(open.value || options.keepMounted) && (
              <Teleport to={options.container ?? 'body'} disabled={!options.container}>
                <div
                  data-testid="floating"
                  ref={floating.refs.setFloating}
                  style={{ pointerEvents: 'none' }}
                />
              </Teleport>
            )}
          </>
        );
      },
    });

    return {
      Follower,
      open,
      reference,
      getStore: () => store,
      getPoint: () => {
        const { x, y } = store.select('anchor')!.getBoundingClientRect();
        return { x, y };
      },
    };
  }

  const getReference = () => screen.getByTestId('reference');

  function moveOnReference(clientX: number, clientY: number) {
    return fireEvent(
      getReference(),
      new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
    );
  }

  function moveOnPage(clientX: number, clientY: number) {
    return fireEvent(
      document.body,
      new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
    );
  }

  const REFERENCE_POINT = { x: REFERENCE_RECT.x, y: REFERENCE_RECT.y };

  it('sets the position when the pointer enters the reference', async () => {
    const { Follower, getPoint } = createFollower();
    await render(<Follower />);

    await fireEvent.mouseEnter(getReference(), { clientX: 300, clientY: 400 });

    expect(getPoint()).toEqual({ x: 300, y: 400 });
  });

  it('follows a change of the axis', async () => {
    const axis = shallowRef<'x' | 'both'>('x');
    const { Follower, getPoint } = createFollower({ axis });
    await render(<Follower />);

    await moveOnReference(500, 600);
    expect(getPoint()).toEqual({ x: 500, y: REFERENCE_POINT.y });

    axis.value = 'both';
    await flushMicrotasks();
    await moveOnReference(700, 800);

    expect(getPoint()).toEqual({ x: 700, y: 800 });
  });

  it('does not follow the cursor while it is disabled', async () => {
    const { Follower, getPoint } = createFollower({ enabled: false });
    await render(<Follower />);

    await fireEvent.mouseEnter(getReference(), { clientX: 300, clientY: 400 });
    await moveOnReference(500, 600);

    expect(getPoint()).toEqual(REFERENCE_POINT);
  });

  describe('the pointer type', () => {
    // The element stays while the popup closes, as it does during an exit transition. The pointer
    // events come before the first move, as in a browser.
    async function closeAfterPointer(
      pointerEvent: 'pointerEnter' | 'pointerDown',
      pointerType: string,
    ) {
      const follower = createFollower({ keepMounted: true });
      await render(<follower.Follower />);
      await fireEvent[pointerEvent](getReference(), { pointerType });

      follower.open.value = true;
      await flushMicrotasks();
      await moveOnPage(100, 100);
      expect(follower.getPoint()).toEqual({ x: 100, y: 100 });

      follower.open.value = false;
      await flushMicrotasks();
      await moveOnPage(300, 400);
      return follower.getPoint();
    }

    it('a mouse follows the cursor while the popup closes', async () => {
      expect(await closeAfterPointer('pointerEnter', 'mouse')).toEqual({ x: 300, y: 400 });
    });

    it.each([
      { name: 'pointerenter', event: 'pointerEnter' },
      { name: 'pointerdown', event: 'pointerDown' },
    ] as const)('a touch pointer stops at the close of the popup: $name', async ({ event }) => {
      expect(await closeAfterPointer(event, 'touch')).toEqual({ x: 100, y: 100 });
    });

    it('does not record the pointer type while it is disabled', async () => {
      const enabled = shallowRef(false);
      const { Follower, open, getPoint } = createFollower({ enabled, keepMounted: true });
      await render(<Follower />);

      await fireEvent.pointerEnter(getReference(), { pointerType: 'touch' });
      await fireEvent.pointerDown(getReference(), { pointerType: 'touch' });
      enabled.value = true;
      open.value = true;
      await flushMicrotasks();
      open.value = false;
      await flushMicrotasks();
      await moveOnPage(300, 400);

      expect(getPoint()).toEqual({ x: 300, y: 400 });
    });
  });

  describe('the point after the open', () => {
    // Positioning reads the point again when the popup opens. After a `mouseenter` or `mousemove`
    // open with a mouse-like pointer, the point stays at the cursor. After another open, the read
    // keeps the offset between the cursor and the reference, so the point moves with the reference.
    it.each([
      {
        name: 'mouseenter',
        pointerType: 'mouse',
        type: 'mouseenter',
        reason: REASONS.triggerHover,
        expected: 'cursor',
      },
      {
        name: 'mousemove',
        pointerType: 'mouse',
        type: 'mousemove',
        reason: REASONS.triggerHover,
        expected: 'cursor',
      },
      {
        name: 'mouseenter of a touch pointer',
        pointerType: 'touch',
        type: 'mouseenter',
        reason: REASONS.triggerHover,
        expected: 'offset',
      },
      {
        name: 'click',
        pointerType: 'mouse',
        type: 'click',
        reason: REASONS.triggerPress,
        expected: 'offset',
      },
    ])(
      'a read after a $name open gives the $expected',
      async ({ pointerType, type, reason, expected }) => {
        const { Follower, reference, getStore, getPoint } = createFollower();
        await render(<Follower />);
        await fireEvent.pointerEnter(getReference(), { pointerType });
        await moveOnReference(500, 500);
        expect(getPoint()).toEqual({ x: 500, y: 500 });

        // The reference moves, as it does when the page scrolls.
        reference.rect.x = 60;
        reference.rect.y = 70;
        getStore().setOpen(
          true,
          createChangeEventDetails(reason, new MouseEvent(type), getReference()),
        );
        await flushMicrotasks();

        expect(getPoint()).toEqual(expected === 'cursor' ? { x: 500, y: 500 } : { x: 550, y: 550 });
      },
    );
  });

  it('does not move a popup that opened while the cursor was disabled, until it opens again', async () => {
    const enabled = shallowRef(false);
    const { Follower, open, getPoint } = createFollower({ enabled });
    await render(<Follower />);
    open.value = true;
    await flushMicrotasks();

    enabled.value = true;
    await flushMicrotasks();
    await moveOnPage(300, 400);
    expect(getPoint()).toEqual(REFERENCE_POINT);

    open.value = false;
    await flushMicrotasks();
    open.value = true;
    await flushMicrotasks();
    await moveOnPage(300, 400);

    expect(getPoint()).toEqual({ x: 300, y: 400 });
  });

  it('stops following the cursor when a key press replaces the open event', async () => {
    const { Follower, getStore, getPoint } = createFollower();
    await render(<Follower />);
    const store = getStore();
    await fireEvent.pointerEnter(getReference(), { pointerType: 'mouse' });
    store.setOpen(
      true,
      createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter'), getReference()),
    );
    await flushMicrotasks();
    await moveOnPage(100, 100);
    expect(getPoint()).toEqual({ x: 100, y: 100 });

    store.setOpen(
      true,
      createChangeEventDetails(REASONS.triggerPress, new KeyboardEvent('keydown'), getReference()),
    );
    await moveOnPage(300, 400);

    expect(getPoint()).toEqual({ x: 100, y: 100 });
  });

  it('follows the cursor in the document of the popup element', async () => {
    // A frame with a `srcdoc` loads a new document, so the case waits for it. Firefox replaces the
    // first document of a frame that it has just added.
    const frame = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
    });
    frame.srcdoc = '<!doctype html><title>frame</title>';
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    await loaded;
    const frameBody = frame.contentDocument!.body;
    const { Follower, open, getPoint } = createFollower({ container: frameBody });
    await render(<Follower />);
    open.value = true;
    await flushMicrotasks();

    await fireEvent(
      frameBody,
      new MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 400 }),
    );

    expect(getPoint()).toEqual({ x: 300, y: 400 });
  });

  it('removes the window listener when the part unmounts', async () => {
    const { Follower, open, getStore } = createFollower();
    const { unmount } = await render(<Follower />);
    open.value = true;
    await flushMicrotasks();
    const store = getStore();
    await moveOnPage(100, 100);
    expect(store.state.anchorOverride).not.toBe(null);

    unmount();
    expect(store.state.anchorOverride).toBe(null);
    await moveOnPage(300, 400);

    expect(store.state.anchorOverride).toBe(null);
  });

  it('removes the window listener while KeepAlive holds the part, and adds it back', async () => {
    const { Follower, open, getPoint } = createFollower();
    const Other = defineComponent({ setup: () => () => <p>other</p> });
    const show = shallowRef(true);
    await render(() => (
      <KeepAlive>{show.value ? <Follower key="follower" /> : <Other key="other" />}</KeepAlive>
    ));
    open.value = true;
    await flushMicrotasks();
    await moveOnPage(100, 100);

    show.value = false;
    await flushMicrotasks();
    await moveOnPage(200, 200);
    const held = getPoint();

    show.value = true;
    await flushMicrotasks();
    await moveOnPage(300, 300);

    expect({ held, active: getPoint() }).toEqual({
      held: { x: 100, y: 100 },
      active: { x: 300, y: 300 },
    });
  });

  describe('a popup of the popup root', () => {
    // The real pointer of the browser stays where an earlier test left it. An element under it gets
    // events that no case sends, so no element of this block takes pointer events.
    const TRIGGER_STYLE = {
      position: 'fixed',
      left: '100px',
      top: '100px',
      width: '300px',
      height: '40px',
      pointerEvents: 'none',
    } as const;

    // The popup root of the fixture, with the positioner of a family. The trigger follows the
    // cursor, and the positioner reads the anchor of the store.
    const CursorPopup = defineComponent({
      setup() {
        const store = inject(PopupFixtureContext)!;
        const clientPoint = useClientPoint(store);
        const mounted = computed(() => store.select('mounted'));

        return () => (
          <>
            <PopupTriggerPart data-testid="trigger" style={TRIGGER_STYLE} {...clientPoint}>
              trigger
            </PopupTriggerPart>
            {mounted.value && (
              <PopupPositionerPart
                data-testid="positioner"
                positionMethod="fixed"
                side="bottom"
                sideOffset={10}
                style={{ width: '50px', height: '20px', pointerEvents: 'none' }}
              >
                <PopupPart>popup</PopupPart>
              </PopupPositionerPart>
            )}
          </>
        );
      },
    });

    function expectPlace(centerX: number, top: number) {
      return waitFor(() => {
        const {
          left,
          width,
          top: actualTop,
        } = screen.getByTestId('positioner').getBoundingClientRect();
        expect({ centerX: Math.round(left + width / 2), top: Math.round(actualTop) }).toEqual({
          centerX,
          top,
        });
      });
    }

    function moveOnTrigger(clientX: number, clientY: number) {
      return fireEvent.mouseMove(screen.getByTestId('trigger'), { clientX, clientY });
    }

    it('places the popup at the cursor, and moves it with the cursor', async () => {
      await render(
        <PopupRootPart>
          <CursorPopup />
        </PopupRootPart>,
      );

      await moveOnTrigger(200, 120);
      await fireEvent.click(screen.getByTestId('trigger'));
      await expectPlace(200, 130);

      await moveOnTrigger(300, 110);
      await expectPlace(300, 120);

      await moveOnPage(350, 400);
      await expectPlace(350, 410);
    });
  });
});
