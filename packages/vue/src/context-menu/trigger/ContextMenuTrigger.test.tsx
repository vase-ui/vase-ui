import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  fireTouch,
  flushMicrotasks,
  isJSDOM,
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
  const stores: MenuStore<unknown>[] = [];
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

  it('should open menu on right click (context menu event)', async () => {
    await render(
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('adds open state attributes', async () => {
    // `user` waits for a timer of the browser, so this case uses real timers.
    vi.useRealTimers();
    const { user } = await render(
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-popup-open', '');

    await user.keyboard('{Escape}');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('should call onOpenChange when menu is opened via right click', async () => {
    const onOpenChange = vi.fn();

    await render(
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
  });

  it('does not cancel opening menu on mouseup after mousedown outside before 500ms', async () => {
    const onOpenChange = vi.fn();

    await render(
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.mouseDown(trigger);
    await fireEvent.contextMenu(trigger);

    await advance(499);

    expect(onOpenChange.mock.calls.length).toBe(1);
    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

    await fireEvent.mouseUp(document.body);

    await advance(1);

    expect(onOpenChange.mock.calls.length).toBe(1);
  });

  it('cancels opening menu on mouseup after mousedown outside after 500ms', async () => {
    const onOpenChange = vi.fn();

    await render(
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.mouseDown(trigger);
    await fireEvent.contextMenu(trigger);

    await advance(501);

    await fireEvent.mouseUp(document.body);

    expect(onOpenChange.mock.calls.length).toBe(2);
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it('keeps the menu open when the context-menu gesture ends inside its positioner', async () => {
    const onOpenChange = vi.fn();

    await render(
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner data-testid="positioner">
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    await fireEvent.contextMenu(screen.getByTestId('trigger'));
    await advance(501);
    await fireEvent.mouseUp(screen.getByTestId('positioner'));

    expect(onOpenChange.mock.calls).toHaveLength(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('aborts the pending document mouseup listener when the trigger unmounts', async () => {
    const onOpenChange = vi.fn();
    const showTrigger = shallowRef(true);

    await render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        {showTrigger.value && (
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        )}
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    await fireEvent.contextMenu(screen.getByTestId('trigger'));

    showTrigger.value = false;
    await flushMicrotasks();

    await advance(501);
    await fireEvent.mouseUp(document.body);

    expect(onOpenChange.mock.calls).toHaveLength(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  describe('prop: disabled', () => {
    it('does not open on right-click when disabled', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireEvent.contextMenu(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });

    it('does not block the native context menu when disabled', async () => {
      await render(
        <ContextMenu.Root disabled>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

      trigger.dispatchEvent(event);
      await flushMicrotasks();

      expect(event.defaultPrevented).toBe(false);
    });
  });

  it('blocks native context menus on both internal and external backdrops', async () => {
    await render(
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Backdrop data-testid="backdrop" />
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const internalBackdrop = document.querySelector(
      '[data-vase-ui-portal] > [data-vase-ui-inert][role="presentation"]',
    )!;
    const externalBackdrop = screen.getByTestId('backdrop');
    const internalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const externalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    internalBackdrop.dispatchEvent(internalEvent);
    externalBackdrop.dispatchEvent(externalEvent);
    document.body.dispatchEvent(outsideEvent);

    expect(internalEvent.defaultPrevented).toBe(true);
    expect(externalEvent.defaultPrevented).toBe(true);
    expect(outsideEvent.defaultPrevented).toBe(false);
  });

  it('blocks native context menus in a portal mounted inside the trigger DOM subtree', async () => {
    const portalContainer = shallowRef<HTMLDivElement | null>(null);

    await render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>
          Right click me
          <div ref={portalContainer} />
        </ContextMenu.Trigger>
        <ContextMenu.Portal container={portalContainer}>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="popup" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    await flushMicrotasks();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByTestId('popup').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

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

  describe.skipIf(isJSDOM)('long press', () => {
    it('should open menu on long press on touchscreen devices', async () => {
      await render(
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });

      await advance(500);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('should cancel long press when touch moves beyond threshold', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });

      // Simulate touch move (more than 10px movement)
      // This should cancel the long press
      await fireTouch.move(trigger, { touches: [{ clientX: 120, clientY: 100 }] });

      await advance(500);

      expect(screen.queryByRole('menu')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });

    it('keeps a pending long press when touch movement stays within the threshold', async () => {
      await render(
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.move(trigger, { touches: [{ clientX: 105, clientY: 105 }] });

      await advance(500);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('cancels a pending long press when the touch ends', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.end(trigger);
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('cancels a pending long press when the gesture becomes multi-touch', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const firstTouch = { clientX: 100, clientY: 100 };
      const touches = [firstTouch, { clientX: 120, clientY: 100 }];

      await fireTouch.start(trigger, { touches: [firstTouch] });
      await fireTouch.move(trigger, { touches });
      await fireTouch.move(trigger, { touches: [firstTouch] });
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);

      await fireTouch.end(trigger);
      await fireTouch.start(trigger, { touches: [firstTouch] });
      await fireTouch.start(trigger, { touches });
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('delays outside-press dismissal after opening from a long press', async () => {
      await render(
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await advance(500);

      await fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).not.toBe(null);

      await advance(500);
      await fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('does not open on long press when disabled', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });

      await advance(500);

      expect(screen.queryByTestId('popup')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });
  });

  it('should handle nested context menus correctly', async () => {
    await render(
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="outer-trigger">
          outer
          <ContextMenu.Root>
            <ContextMenu.Trigger>inner</ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup data-testid="inner-menu" />
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="outer-menu" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    const innerTrigger = screen.getByText('inner');
    const outerTrigger = screen.getByText('outer');

    await fireEvent.contextMenu(innerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).not.toBe(null);
    expect(screen.queryByTestId('outer-menu')).toBe(null);

    await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).toBe(null);

    await fireEvent.contextMenu(outerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-menu')).not.toBe(null);
    expect(screen.queryByTestId('inner-menu')).toBe(null);
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

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });

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
  });

  describe('the mouseup of the press', () => {
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
  });

  describe('an outside press', () => {
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

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
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

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.move(trigger, { touches: [point] });
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

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.move(trigger, { touches: [{ clientX: 110, clientY: 90 }] });
      await advance(500);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('cancels when the touch gets touchcancel', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );
      const trigger = getByTestId('trigger');

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.cancel(trigger);
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

      await fireTouch.start(getByTestId('trigger'), { touches: [{ clientX: 100, clientY: 100 }] });
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

      await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
      await fireTouch.move(trigger, { touches: [{ clientX: 140, clientY: 100 }] });
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

      await fireTouch.start(getByTestId('trigger'), { touches: [{ clientX: 100, clientY: 100 }] });
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

    it('does not open for a disabled root', async () => {
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.pointerDown(getByTestId('trigger'), {
        pointerType: 'pen',
        clientX: 50,
        clientY: 50,
      });
      await advance(500);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('a trigger around the trigger', () => {
    it.each([
      {
        name: 'a finger',
        press: (trigger: Element) =>
          fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] }),
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
    await fireTouch.start(trigger, { touches: [{ clientX: 100, clientY: 100 }] });
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
