import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { useMenuRootContext } from '../../menu/root/MenuRootContext';
import type { MenuStore } from '../../menu/store/MenuStore';
import * as ContextMenu from '../index.parts';
import { useContextMenuRootContext } from '../root/ContextMenuRootContext';
import type { ContextMenuRootContext } from '../root/ContextMenuRootContext';

/** Reads the context and the Menu store that a part below the root gets. */
function createProbe() {
  const contexts: ContextMenuRootContext[] = [];
  const stores: Array<MenuStore<unknown>> = [];
  const Probe = defineComponent({
    setup() {
      contexts.push(useContextMenuRootContext(false));
      stores.push(useMenuRootContext().store);
      return () => null;
    },
  });

  return {
    Probe,
    get context() {
      return contexts[0];
    },
    get store() {
      return stores[0];
    },
  };
}

function getAnchorRect(context: ContextMenuRootContext) {
  const { x, y, width, height } = context.anchor.value.getBoundingClientRect();
  return [x, y, width, height];
}

function createContextMenuEvent(init: MouseEventInit = {}) {
  return new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...init });
}

// WebKit on a desktop cannot make a `Touch`, so the event gets a `touches` list by hand.
function fireTouch(
  element: Element,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  points: Array<{ clientX: number; clientY: number }> = [],
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: points });
  return fireEvent(element, event);
}

async function advance(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await flushMicrotasks();
}

describe('<ContextMenu.Trigger />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describeConformance(<ContextMenu.Trigger />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<ContextMenu.Root>{node}</ContextMenu.Root>);
    },
  }));

  it('blocks the native context menu when onContextMenu skips the Base UI handler', async () => {
    await render(
      <ContextMenu.Root>
        <ContextMenu.Trigger
          data-testid="trigger"
          onContextmenu={(event) => event.preventVaseUIHandler()}
        >
          Right click me
        </ContextMenu.Trigger>
      </ContextMenu.Root>,
    );

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByTestId('trigger').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  describe('the open at the pointer', () => {
    it('opens the menu at the point of a contextmenu event', async () => {
      const calls: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root
          onOpenChange={(open, details) => calls.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => calls.push(['update:open', open])}
        >
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');
      const event = createContextMenuEvent({ clientX: 30, clientY: 40 });

      expect(trigger).not.toHaveAttribute('data-popup-open');

      trigger.dispatchEvent(event);
      await flushMicrotasks();

      expect(calls).toEqual([
        ['openChange', true, 'trigger-press'],
        ['update:open', true],
      ]);
      expect(event.defaultPrevented).toBe(true);
      expect(getAnchorRect(probe.context)).toEqual([30, 40, 0, 0]);
      expect(probe.context.initialCursorPointRef.value).toEqual({ x: 30, y: 40 });
      expect(probe.context.allowMouseUpTriggerRef.value).toBe(true);
      expect(trigger).toHaveAttribute('data-popup-open', '');
      expect(trigger).toHaveAttribute('data-pressed', '');
    });

    it('sets allowMouseUpTriggerRef for a contextmenu event after a long press with a finger', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);

      expect(probe.context.allowMouseUpTriggerRef.value).toBe(false);

      await fireEvent.contextMenu(trigger);

      expect(probe.context.allowMouseUpTriggerRef.value).toBe(true);
    });

    it('reports the contextmenu event in the details', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const event = createContextMenuEvent();

      getByTestId('trigger').dispatchEvent(event);
      await flushMicrotasks();

      expect(onOpenChange.mock.lastCall?.[1].event).toBe(event);
    });

    it('does not give the contextmenu event to an element around the trigger', async () => {
      const onContextmenu = vi.fn();
      const { getByTestId } = await render(
        <div onContextmenu={onContextmenu}>
          <ContextMenu.Root>
            <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          </ContextMenu.Root>
        </div>,
      );

      await fireEvent.contextMenu(getByTestId('trigger'));

      expect(onContextmenu).not.toHaveBeenCalled();
    });

    it('opens only the inner menu for an event on the trigger of a root in a trigger', async () => {
      const outer = vi.fn();
      const inner = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={outer}>
          <ContextMenu.Trigger data-testid="outer">
            outer
            <ContextMenu.Root onOpenChange={inner}>
              <ContextMenu.Trigger data-testid="inner">inner</ContextMenu.Trigger>
            </ContextMenu.Root>
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.contextMenu(getByTestId('inner'));

      expect(inner).toHaveBeenCalledTimes(1);
      expect(outer).not.toHaveBeenCalled();

      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.contextMenu(getByTestId('outer'));

      expect(inner).toHaveBeenCalledTimes(2);
      expect(inner.mock.lastCall?.[0]).toBe(false);
      expect(outer).toHaveBeenCalledTimes(1);
      expect(outer.mock.lastCall?.[0]).toBe(true);
    });
  });

  describe('the mouseup of the press', () => {
    it('keeps the menu open for a mouseup in the first 500 ms', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.contextMenu(getByTestId('trigger'));
      await advance(499);
      await fireEvent.mouseUp(document.body);
      await advance(1);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('closes the menu with the reason cancel-open for a mouseup after 500 ms', async () => {
      const calls: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root
          onOpenChange={(open, details) =>
            calls.push(['openChange', open, details.reason, details.event.type])
          }
          onUpdate:open={(open) => calls.push(['update:open', open])}
        >
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.contextMenu(getByTestId('trigger'));
      await advance(500);
      await fireEvent.mouseUp(document.body);

      expect(calls).toEqual([
        ['openChange', true, 'trigger-press', 'contextmenu'],
        ['update:open', true],
        ['openChange', false, 'cancel-open', 'mouseup'],
        ['update:open', false],
      ]);
      expect(probe.context.allowMouseUpTriggerRef.value).toBe(false);
    });

    it('keeps the menu open for a mouseup in the positioner element', async () => {
      const onOpenChange = vi.fn();
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <div data-testid="positioner">
            <span data-testid="inside" />
          </div>
        </ContextMenu.Root>,
      );
      probe.store.set('positionerElement', getByTestId('positioner'));
      await flushMicrotasks();

      expect(probe.context.positionerRef.value).toBe(getByTestId('positioner'));

      await fireEvent.contextMenu(getByTestId('trigger'));
      await advance(501);
      await fireEvent.mouseUp(getByTestId('inside'));

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(probe.store.state.open).toBe(true);
    });

    it('removes the mouseup listener when the trigger unmounts', async () => {
      const onOpenChange = vi.fn();
      const probe = createProbe();
      const shown = shallowRef(true);
      const { getByTestId } = await render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <probe.Probe />
          {shown.value ? (
            <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          ) : null}
        </ContextMenu.Root>
      ));

      await fireEvent.contextMenu(getByTestId('trigger'));
      shown.value = false;
      await flushMicrotasks();
      await advance(501);
      await fireEvent.mouseUp(document.body);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      // The listener of the press would write `false`.
      expect(probe.context.allowMouseUpTriggerRef.value).toBe(true);
    });
  });

  describe('an outside press', () => {
    it('closes at once after a contextmenu event, and only after 500 ms after a long press', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');
      const pressOutside = () => fireEvent.pointerDown(document.body, { pointerType: 'mouse' });

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await advance(500);
      await pressOutside();

      expect(onOpenChange).toHaveBeenCalledTimes(1);

      await advance(500);
      await pressOutside();

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('outside-press');

      await fireEvent.contextMenu(trigger);
      await pressOutside();

      expect(onOpenChange).toHaveBeenCalledTimes(4);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('outside-press');
    });

    it('closes the open menu and opens it at the new point for a second right press', async () => {
      const calls: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root
          onOpenChange={(open, details) => calls.push([open, details.reason, details.event.type])}
        >
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.contextMenu(trigger, { clientX: 20, clientY: 30 });
      await advance(20);
      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        button: 2,
        clientX: 120,
        clientY: 90,
      });
      await fireEvent.contextMenu(trigger, { clientX: 120, clientY: 90 });

      expect(calls).toEqual([
        [true, 'trigger-press', 'contextmenu'],
        [false, 'outside-press', 'pointerdown'],
        [true, 'trigger-press', 'contextmenu'],
      ]);
      expect(getAnchorRect(probe.context)).toEqual([120, 90, 0, 0]);
    });

    it('keeps the menu open for the mouseup of a second right press', async () => {
      const calls: unknown[] = [];
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={(open, details) => calls.push([open, details.reason])}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.contextMenu(trigger);
      await advance(500);
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 2 });
      await fireEvent.contextMenu(trigger);
      await fireEvent.mouseUp(document.body);

      expect(calls).toEqual([
        [true, 'trigger-press'],
        [false, 'outside-press'],
        [true, 'trigger-press'],
      ]);
    });
  });

  describe('a disabled root', () => {
    it.each([
      {
        name: 'a contextmenu event',
        async press(trigger: Element) {
          const event = createContextMenuEvent();
          trigger.dispatchEvent(event);
          await flushMicrotasks();
          expect(event.defaultPrevented).toBe(false);
        },
      },
      {
        name: 'a long press with a finger',
        async press(trigger: Element) {
          await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
        },
      },
      {
        name: 'a long press with a stylus',
        async press(trigger: Element) {
          await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
        },
      },
    ])('does not open for $name', async ({ press }) => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await press(getByTestId('trigger'));
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('the native menu', () => {
    it('stays closed on the backdrop elements of the context and nowhere else', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <div data-testid="backdrop" />
          <div data-testid="internal-backdrop" />
          <div data-testid="other" />
        </ContextMenu.Root>,
      );
      probe.context.backdropRef.value = getByTestId('backdrop') as HTMLDivElement;
      probe.context.internalBackdropRef.value = getByTestId('internal-backdrop') as HTMLDivElement;

      const prevented = ['trigger', 'backdrop', 'internal-backdrop', 'other'].map((testId) => {
        const event = createContextMenuEvent();
        getByTestId(testId).dispatchEvent(event);
        return event.defaultPrevented;
      });

      expect(prevented).toEqual([true, true, true, false]);
    });
  });

  describe('a long press with a finger', () => {
    it('opens the menu after 500 ms, with an anchor of 10 by 10', async () => {
      const probe = createProbe();
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await advance(499);

      expect(onOpenChange).not.toHaveBeenCalled();

      await advance(1);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-press');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('touchstart');
      expect(getAnchorRect(probe.context)).toEqual([100, 100, 10, 10]);
      expect(probe.context.initialCursorPointRef.value).toEqual({ x: 100, y: 100 });
      expect(probe.context.allowMouseUpTriggerRef.value).toBe(false);
      expect(trigger).toHaveAttribute('data-popup-open', '');
    });

    it.each([
      { axis: 'horizontal', point: { clientX: 111, clientY: 100 } },
      { axis: 'vertical', point: { clientX: 100, clientY: 111 } },
    ])('cancels for a move of more than 10 px on the $axis axis', async ({ point }) => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await fireTouch(trigger, 'touchmove', [point]);
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('keeps the press for a move of 10 px or less', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await fireTouch(trigger, 'touchmove', [{ clientX: 110, clientY: 90 }]);
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it.each([{ type: 'touchend' as const }, { type: 'touchcancel' as const }])(
      'cancels when the touch gets $type',
      async ({ type }) => {
        const onOpenChange = vi.fn();
        const { getByTestId } = await render(
          <ContextMenu.Root onOpenChange={onOpenChange}>
            <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          </ContextMenu.Root>,
        );
        const trigger = getByTestId('trigger');

        await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
        await fireTouch(trigger, type);
        await advance(500);

        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      {
        name: 'at the start',
        async press(trigger: Element) {
          await fireTouch(trigger, 'touchstart', [
            { clientX: 100, clientY: 100 },
            { clientX: 120, clientY: 100 },
          ]);
        },
      },
      {
        name: 'in a move',
        async press(trigger: Element) {
          await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
          await fireTouch(trigger, 'touchmove', [
            { clientX: 100, clientY: 100 },
            { clientX: 120, clientY: 100 },
          ]);
        },
      },
    ])('cancels for a second finger $name', async ({ press }) => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await press(getByTestId('trigger'));
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('lets a passive touchstart listener of the consumer stop the long press', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger
            data-testid="trigger"
            {...{
              onTouchstartPassive: (event: Event & { preventVaseUIHandler: () => void }) =>
                event.preventVaseUIHandler(),
            }}
          >
            Long press me
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireTouch(getByTestId('trigger'), 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('lets a passive touchmove listener of the consumer stop the check of the move', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger
            data-testid="trigger"
            {...{
              onTouchmovePassive: (event: Event & { preventVaseUIHandler: () => void }) =>
                event.preventVaseUIHandler(),
            }}
          >
            Long press me
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await fireTouch(trigger, 'touchmove', [{ clientX: 140, clientY: 100 }]);
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('does not let a touchstart listener with no modifier stop the long press', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger
            data-testid="trigger"
            onTouchstart={(event) => event.preventVaseUIHandler()}
          >
            Long press me
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireTouch(getByTestId('trigger'), 'touchstart', [{ clientX: 100, clientY: 100 }]);
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('BUG-4854: a long press with a stylus', () => {
    it('opens the menu after 500 ms, with an anchor of 0 by 0', async () => {
      const probe = createProbe();
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await advance(499);

      expect(onOpenChange).not.toHaveBeenCalled();

      await advance(1);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-press');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('pointerdown');
      expect(getAnchorRect(probe.context)).toEqual([50, 50, 0, 0]);
      expect(probe.context.allowMouseUpTriggerRef.value).toBe(false);
      expect(trigger).toHaveAttribute('data-popup-open', '');
    });

    it('cancels for a move of more than 10 px, and keeps the press for a smaller move', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await fireEvent.pointerMove(trigger, { pointerType: 'pen', clientX: 61, clientY: 50 });
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();

      await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await fireEvent.pointerMove(trigger, { pointerType: 'pen', clientX: 55, clientY: 55 });
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it.each([
      { type: 'pointerup', fire: 'pointerUp' as const },
      { type: 'pointercancel', fire: 'pointerCancel' as const },
      { type: 'pointerleave', fire: 'pointerLeave' as const },
    ])('cancels when the pen gets $type', async ({ fire }) => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await fireEvent[fire](trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('keeps the press while another pointer moves or leaves', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 });
      await fireEvent.pointerMove(trigger, { pointerType: 'touch', clientX: 100, clientY: 50 });
      await fireEvent.pointerUp(trigger, { pointerType: 'touch', clientX: 100, clientY: 50 });
      await fireEvent.pointerCancel(trigger, { pointerType: 'mouse' });
      await fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it.each([{ pointerType: 'mouse' }, { pointerType: 'touch' }])(
      'starts no long press for a $pointerType pointer',
      async ({ pointerType }) => {
        const onOpenChange = vi.fn();
        const { getByTestId } = await render(
          <ContextMenu.Root onOpenChange={onOpenChange}>
            <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          </ContextMenu.Root>,
        );

        await fireEvent.pointerDown(getByTestId('trigger'), {
          pointerType,
          clientX: 50,
          clientY: 50,
        });
        await advance(500);

        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );
  });

  describe('a trigger around the trigger', () => {
    it.each([
      {
        name: 'a finger',
        press: (trigger: Element) =>
          fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]),
      },
      {
        name: 'a stylus',
        press: (trigger: Element) =>
          fireEvent.pointerDown(trigger, { pointerType: 'pen', clientX: 50, clientY: 50 }),
      },
    ])('starts no long press for a press of $name', async ({ press }) => {
      const outer = vi.fn();
      const inner = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={outer}>
          <ContextMenu.Trigger>
            <ContextMenu.Root onOpenChange={inner}>
              <ContextMenu.Trigger data-testid="inner">inner</ContextMenu.Trigger>
            </ContextMenu.Root>
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await press(getByTestId('inner'));
      await advance(500);

      expect(inner).toHaveBeenCalledTimes(1);
      expect(outer).not.toHaveBeenCalled();
    });
  });

  it('VUE-5: a deactivated trigger releases the document listener, the long press and the mouseup listener', async () => {
    const onOpenChange = vi.fn();
    const probe = createProbe();
    const shown = shallowRef(true);
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    onTestFinished(() => {
      addListener.mockRestore();
      removeListener.mockRestore();
    });
    const countCalls = (spy: typeof addListener, type: string) =>
      spy.mock.calls.filter(([name]) => name === type).length;
    const Branch = defineComponent({
      setup: () => () => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </ContextMenu.Root>
      ),
    });
    const Other = defineComponent({ setup: () => () => <span /> });
    const { getByTestId } = await render(() => (
      <KeepAlive>{shown.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
    ));
    const trigger = getByTestId('trigger');

    expect(countCalls(addListener, 'contextmenu')).toBe(1);
    expect(countCalls(removeListener, 'contextmenu')).toBe(0);

    // A long press and the listener of the mouseup wait.
    await fireTouch(trigger, 'touchstart', [{ clientX: 100, clientY: 100 }]);
    await fireEvent.contextMenu(trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(1);

    shown.value = false;
    await flushMicrotasks();

    expect(countCalls(removeListener, 'contextmenu')).toBe(1);

    await advance(501);
    await fireEvent.mouseUp(document.body);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(probe.context.allowMouseUpTriggerRef.value).toBe(true);

    shown.value = true;
    await flushMicrotasks();

    expect(countCalls(addListener, 'contextmenu')).toBe(2);
    expect(getByTestId('trigger')).toBe(trigger);

    const event = createContextMenuEvent();
    trigger.dispatchEvent(event);
    await flushMicrotasks();

    expect(event.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside ContextMenu.Root', async () => {
    await expect(render(<ContextMenu.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Context Menu must be inside <ContextMenu.Root>. Without a root the part has no context menu state. Put the part inside <ContextMenu.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
