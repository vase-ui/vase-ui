import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, onMounted, shallowRef } from 'vue';
import type { CSSProperties, ShallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { PopupFixtureStore } from '../../../../test/fixtures/PopupFixture';
import { useFloating } from '../../../../test/fixtures/useFloating';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getHoverIntent } from './hoverIntent';
import { safePolygon } from './safePolygon';
import { useHoverTriggerInteraction } from './useHoverTriggerInteraction';
import type { UseHoverTriggerInteractionProps } from './useHoverTriggerInteraction';

describe('useHoverTriggerInteraction', () => {
  const { render } = createRenderer();

  it('updates the handleClose options during render', async () => {
    const block = shallowRef(false);
    let store!: FloatingRootStore;

    const App = defineComponent({
      setup() {
        const { context } = useFloating();
        store = context.rootStore;
        useHoverTriggerInteraction(context.rootStore, {
          handleClose: () => safePolygon({ blockPointerEvents: block.value }),
        });
        return () => null;
      },
    });

    await render(<App />);
    expect(getHoverIntent(store).handleCloseOptions?.blockPointerEvents).toBe(false);

    block.value = true;
    await flushMicrotasks();
    expect(getHoverIntent(store).handleCloseOptions?.blockPointerEvents).toBe(true);
  });

  // The setup of the cases that give the listeners to a wrapper of the trigger. The popup is open.
  function useWrapped(
    onOpenChange: (open: boolean, details: unknown) => void,
    options: UseHoverTriggerInteractionProps = {
      mouseOnly: true,
      restMs: 100,
      delay: { close: 0 },
      move: false,
    },
  ) {
    const open = shallowRef(true);
    const triggerElement = shallowRef<Element | null>(null);
    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen, details) {
        onOpenChange(nextOpen, details);
        open.value = nextOpen;
      },
    });
    const hoverProps = useHoverTriggerInteraction(context.rootStore, {
      ...options,
      triggerElement,
    });
    // A function ref that registers the element of a trigger. Vue calls it with `null` at unmount.
    const register = (id: string) => (node: unknown) => {
      if (node) {
        context.rootStore.context.triggerElements.add(id, node as Element);
      }
    };
    return { open, refs, context, hoverProps, triggerElement, register };
  }

  it('does not treat child target as inactive when handlers are on a wrapper', async () => {
    const onOpenChange = vi.fn();

    const App = defineComponent({
      setup() {
        const { open, refs, hoverProps, triggerElement } = useWrapped(onOpenChange);
        function setTrigger(node: unknown) {
          refs.setReference(node);
          triggerElement.value = node as Element | null;
        }

        return () => (
          <>
            <div data-testid="wrapper" {...hoverProps}>
              <button data-testid="trigger" ref={setTrigger} />
            </div>
            {open.value && <div role="tooltip" ref={refs.setFloating} />}
          </>
        );
      },
    });

    await render(<App />);

    const wrapper = screen.getByTestId('wrapper');
    const trigger = screen.getByTestId('trigger');

    await fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(wrapper);
    await fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

    await flushMicrotasks();

    // Moving over the active trigger should not emit a redundant openchange.
    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('does not treat a synthetic child target as inactive when the native path differs', async () => {
    const onOpenChange = vi.fn();

    const App = defineComponent({
      setup() {
        const { open, refs, hoverProps, triggerElement, register } = useWrapped(onOpenChange);
        function setTrigger(node: unknown) {
          refs.setReference(node);
          triggerElement.value = node as Element | null;
          register('trigger')(node);
        }

        return () => (
          <>
            <div data-testid="wrapper" {...hoverProps}>
              <button data-testid="trigger" ref={setTrigger}>
                <span data-testid="child" />
              </button>
            </div>
            <button data-testid="other-trigger" ref={register('other-trigger')} />
            {open.value && <div role="tooltip" ref={refs.setFloating} />}
          </>
        );
      },
    });

    await render(<App />);

    const wrapper = screen.getByTestId('wrapper');
    const otherTrigger = screen.getByTestId('other-trigger');
    const child = screen.getByTestId('child');

    await fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    // Entering the active trigger clears `blockMouseMove`, so a misclassified move would reopen.
    await fireEvent.mouseEnter(wrapper);

    const event = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperties(event, {
      // Deliberately skew the native path so `getTarget(event)` resolves to another
      // registered trigger while `event.target` remains `child`.
      composedPath: { configurable: true, value: () => [otherTrigger, wrapper] },
      movementX: { configurable: true, value: 10 },
      movementY: { configurable: true, value: 0 },
    });

    await fireEvent(child, event);

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('treats disabled child trigger as inactive in wrapper fallback mode', async () => {
    const onOpenChange = vi.fn();

    const App = defineComponent({
      setup() {
        const { open, refs, hoverProps, triggerElement, register } = useWrapped(onOpenChange);

        function setActiveTrigger(node: unknown) {
          refs.setReference(node);
          triggerElement.value = node as Element | null;
        }

        return () => (
          <>
            <button data-testid="active-trigger" ref={setActiveTrigger} />
            <div data-testid="inactive-wrapper" {...hoverProps}>
              <button
                data-testid="disabled-trigger"
                data-trigger-disabled
                ref={register('disabled-trigger')}
              />
            </div>
            {open.value && <div role="tooltip" ref={refs.setFloating} />}
          </>
        );
      },
    });

    await render(<App />);

    const wrapper = screen.getByTestId('inactive-wrapper');
    const disabledTrigger = screen.getByTestId('disabled-trigger');

    await fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(wrapper);
    await fireEvent.mouseMove(disabledTrigger, { movementX: 10, movementY: 0 });

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('reopens immediately for same trigger in delegated wrapper mode during close transition', async () => {
    const onOpenChange = vi.fn();
    let closeFromHover: (() => void) | undefined;

    const App = defineComponent({
      setup() {
        const { open, refs, context, hoverProps, triggerElement } = useWrapped(
          (nextOpen, details) => {
            onOpenChange(nextOpen, details);
            // Simulate active close transition lifecycle while closed.
            context.rootStore.set('transitionStatus', nextOpen ? undefined : 'ending');
          },
          { mouseOnly: true, move: false, delay: { open: 500, close: 0 } },
        );

        closeFromHover = () => {
          context.rootStore.setOpen(
            false,
            createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseleave')),
          );
        };

        return () => (
          <>
            <div
              data-testid="wrapper"
              {...hoverProps}
              ref={(node) => (triggerElement.value = node as Element | null)}
            >
              <button data-testid="trigger" ref={refs.setReference} />
            </div>
            {open.value && <div role="tooltip" ref={refs.setFloating} />}
          </>
        );
      },
    });

    await render(<App />);

    const wrapper = screen.getByTestId('wrapper');
    await flushMicrotasks();

    closeFromHover?.();
    await flushMicrotasks();

    await flushMicrotasks();
    expect(screen.queryByRole('tooltip')).toBe(null);

    await fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(wrapper);

    await flushMicrotasks();

    // Close from hover + immediate reopen without waiting open delay.
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(true);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  describe('rules with no Base UI case', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      document.body.style.removeProperty('pointer-events');
    });

    // The trigger is at 0, 0 and the popup is at 200, 0. Each one is 100 by 100.
    const BOX: CSSProperties = { position: 'fixed', top: '0px', width: '100px', height: '100px' };

    // The browser keeps its real pointer where an earlier test left it. A trigger under that pointer
    // gets a trusted `mouseenter` in a later frame, and the popup opens. Each app of this block
    // renders in a wrapper with this style. A dispatched event still reaches the listeners. The
    // style is not on the trigger, because the hover intent removes it from the trigger.
    const NO_POINTER_EVENTS: CSSProperties = { pointerEvents: 'none' };

    // A trigger that opens a popup on hover. `calls` lists the open changes that the owner hears.
    // As a popup root does, the app moves the anchor to the trigger that opens the popup.
    function createHoverApp({
      secondTrigger,
      ...options
    }: UseHoverTriggerInteractionProps & { secondTrigger?: boolean } = {}) {
      const calls: { open: boolean; reason: string; trigger: string | undefined }[] = [];
      const open = shallowRef(false);
      let store!: FloatingRootStore;

      const App = defineComponent({
        setup() {
          const { refs, context } = useFloating({
            open,
            placement: 'right',
            onOpenChange(nextOpen, details: VaseUIChangeEventDetails<string>) {
              calls.push({ open: nextOpen, reason: details.reason, trigger: details.trigger?.id });
              if (nextOpen && details.trigger) {
                refs.setReference(details.trigger);
              }
              open.value = nextOpen;
            },
          });
          store = context.rootStore;
          const hoverProps = useHoverTriggerInteraction(store, {
            triggerElement: refs.reference,
            ...options,
          });
          const register = (id: string) => (node: unknown) => {
            if (node) {
              store.context.triggerElements.add(id, node as Element);
            }
          };

          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button
                id="trigger"
                data-testid="trigger"
                style={{ ...BOX, left: '0px' }}
                {...hoverProps}
                ref={(node) => {
                  register('trigger')(node);
                  refs.setReference(node);
                }}
              />
              {secondTrigger && (
                <button
                  id="second"
                  data-testid="second"
                  style={{ ...BOX, left: '0px', top: '150px' }}
                  {...hoverProps}
                  ref={register('second')}
                />
              )}
              {open.value && (
                <div data-testid="popup" style={{ ...BOX, left: '200px' }} ref={refs.setFloating} />
              )}
            </div>
          );
        },
      });

      return { App, calls, getStore: () => store };
    }

    // A trigger that moves from the first store to the second store when `second` is `true`.
    // `opened` lists the store that gets each open request.
    function createStoreChangeApp(options: UseHoverTriggerInteractionProps = {}) {
      const second = shallowRef(false);
      const opened: string[] = [];
      const App = defineComponent({
        setup() {
          const stores = {
            first: useFloating({ onOpenChange: () => opened.push('first') }).context.rootStore,
            second: useFloating({ onOpenChange: () => opened.push('second') }).context.rootStore,
          };
          const store = computed(() => (second.value ? stores.second : stores.first));
          const hoverProps = useHoverTriggerInteraction(store, options);
          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button data-testid="trigger" {...hoverProps} />
            </div>
          );
        },
      });

      return { App, second, opened };
    }

    // `KeepAlive` deactivates the app while `Other` shows. It does not unmount the app.
    const Other = defineComponent({ setup: () => () => <p>other</p> });

    async function renderInKeepAlive(App: ReturnType<typeof createHoverApp>['App']) {
      const show = shallowRef(true);
      const { unmount } = await render(() => (
        <KeepAlive>{show.value ? <App key="app" /> : <Other key="other" />}</KeepAlive>
      ));
      return {
        unmount,
        async toggle(visible: boolean) {
          show.value = visible;
          await flushMicrotasks();
        },
      };
    }

    const getTrigger = () => screen.getByTestId('trigger');
    const isOpen = () => screen.queryByTestId('popup') !== null;

    async function enter(element: Element, pointerType = 'mouse') {
      await fireEvent.pointerEnter(element, { pointerType });
      await fireEvent.mouseEnter(element);
    }

    async function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    it.each([
      { name: 'touch', expected: false },
      { name: 'pen', expected: true },
      { name: 'mouse', expected: true },
    ])('with mouseOnly, a $name pointer opens: $expected', async ({ name, expected }) => {
      const { App } = createHoverApp({ mouseOnly: true });
      await render(<App />);

      await enter(getTrigger(), name);

      expect(isOpen()).toBe(expected);
    });

    it.each([
      { name: 'touch', atOnce: true },
      { name: 'mouse', atOnce: false },
    ])('with an open delay, a $name pointer opens at once: $atOnce', async (row) => {
      const { App } = createHoverApp({ delay: 500 });
      await render(<App />);

      await enter(getTrigger(), row.name);
      expect(isOpen()).toBe(row.atOnce);

      await tick(500);
      expect(isOpen()).toBe(true);
    });

    it('does not open while it is disabled', async () => {
      const { App } = createHoverApp({ enabled: false });
      await render(<App />);

      await enter(getTrigger());
      await fireEvent.mouseMove(getTrigger());
      await tick(1000);

      expect(isOpen()).toBe(false);
    });

    it('VUE-24: cancels an open that waits when the trigger gets disabled', async () => {
      const enabled = shallowRef(true);
      const { App, calls } = createHoverApp({ delay: 500, enabled });
      await render(<App />);
      // The count can hold a timer of Vue: the first app of a page starts one in a development
      // build. So each case that counts timers compares with the count after the mount.
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());
      await tick(100);
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      enabled.value = false;
      await flushMicrotasks();
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      expect(calls).toEqual([]);
    });

    it.each([
      { name: 'with move', move: true },
      { name: 'without move', move: false },
    ])('opens on a mousemove with no mouseenter: $move, $name', async (row) => {
      const { App } = createHoverApp({ move: row.move });
      await render(<App />);

      await fireEvent.mouseMove(getTrigger());

      expect(isOpen()).toBe(row.move);
    });

    it.each([
      { name: 'enabled', changes: { enabled: [false, true] } },
      { name: 'move', changes: { move: [false, true] } },
      { name: 'mouseOnly', changes: { mouseOnly: [true] } },
      { name: 'the tree', changes: { externalTree: [new FloatingTreeStore()] } },
    ])(
      'the first mousemove of a period counts as an enter again after a change of $name',
      async (row) => {
        const sources = {
          enabled: shallowRef(true),
          move: shallowRef(true),
          mouseOnly: shallowRef(false),
          externalTree: shallowRef<FloatingTreeStore | undefined>(undefined),
        };
        const { App } = createHoverApp(sources);
        await render(<App />);
        await fireEvent.mouseMove(getTrigger());
        await fireEvent.mouseLeave(getTrigger());
        // The first mousemove of the period is spent.
        await fireEvent.mouseMove(getTrigger());
        expect(isOpen()).toBe(false);

        for (const [key, values] of Object.entries(row.changes)) {
          for (const value of values) {
            (sources[key as keyof typeof sources] as ShallowRef<unknown>).value = value;
            await flushMicrotasks();
          }
        }
        await fireEvent.mouseMove(getTrigger());

        expect(isOpen()).toBe(true);
      },
    );

    it('the first mousemove of a period counts as an enter again after a change of the store', async () => {
      const { App, second, opened } = createStoreChangeApp();
      await render(<App />);
      await fireEvent.mouseMove(getTrigger());

      second.value = true;
      await flushMicrotasks();
      await fireEvent.mouseMove(getTrigger());

      expect(opened).toEqual(['first', 'second']);
    });

    it('stops the open delay when the trigger unmounts', async () => {
      const { App, calls } = createHoverApp({ delay: 500 });
      const { unmount } = await render(<App />);
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      unmount();
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      expect(calls).toEqual([]);
    });

    it('stops the open delay when KeepAlive deactivates the trigger', async () => {
      const { App, calls } = createHoverApp({ delay: 500 });
      const view = await renderInKeepAlive(App);
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      await view.toggle(false);
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      await view.toggle(true);
      expect(calls).toEqual([]);
    });

    describe('VUE-26: a popup that hover opened closes when KeepAlive deactivates its trigger', () => {
      it.each([
        { name: 'while the pointer is on the trigger', delay: 0, leave: false },
        { name: 'while a close delay waits', delay: 300, leave: true },
      ])('closes $name', async ({ delay, leave }) => {
        const { App, calls } = createHoverApp({ delay: { close: delay } });
        const view = await renderInKeepAlive(App);
        const timersAfterMount = vi.getTimerCount();
        await enter(getTrigger());
        if (leave) {
          await fireEvent.mouseLeave(getTrigger());
        }

        await view.toggle(false);
        expect(vi.getTimerCount()).toBe(timersAfterMount);
        await view.toggle(true);

        expect(isOpen()).toBe(false);
        expect(calls).toEqual([
          { open: true, reason: REASONS.triggerHover, trigger: 'trigger' },
          { open: false, reason: REASONS.triggerHover, trigger: undefined },
        ]);
      });

      it.each([
        { name: 'a press opened', anchor: undefined },
        { name: 'another trigger anchors', anchor: document.createElement('button') },
      ])('keeps a popup that $name', async (row) => {
        const { App, calls, getStore } = createHoverApp(
          row.anchor ? { triggerElement: row.anchor } : {},
        );
        const view = await renderInKeepAlive(App);
        if (row.anchor) {
          await enter(getTrigger());
        } else {
          getStore().setOpen(
            true,
            createChangeEventDetails(REASONS.triggerPress, new MouseEvent('click'), getTrigger()),
          );
          await flushMicrotasks();
        }

        await view.toggle(false);
        await view.toggle(true);

        expect(isOpen()).toBe(true);
        expect(calls).toHaveLength(1);
      });
    });

    describe('the safe polygon', () => {
      const handleClose = () => safePolygon();

      function trackDocumentMousemoveListeners() {
        const added = vi.spyOn(document, 'addEventListener');
        const removed = vi.spyOn(document, 'removeEventListener');
        const count = (spy: typeof added) =>
          spy.mock.calls.filter(([type]) => type === 'mousemove').length;
        return () => count(added) - count(removed);
      }

      function moveOnDocument(clientX: number, clientY: number) {
        return fireEvent(
          document.body,
          new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
        );
      }

      it('listens to the document from the leave until the pointer leaves the polygon', async () => {
        const { App } = createHoverApp({ handleClose });
        await render(<App />);
        await enter(getTrigger());
        await flushMicrotasks();
        const listeners = trackDocumentMousemoveListeners();

        await fireEvent.mouseLeave(getTrigger(), { clientX: 100, clientY: 50 });
        expect(listeners()).toBe(1);

        // The pointer is in the trough between the trigger and the popup.
        await moveOnDocument(150, 50);
        await tick(50);
        expect({ open: isOpen(), listeners: listeners() }).toEqual({ open: true, listeners: 1 });

        await moveOnDocument(150, 400);
        await tick(50);
        expect({ open: isOpen(), listeners: listeners() }).toEqual({ open: false, listeners: 0 });
      });

      it.each([
        { name: 'the trigger unmounts', release: (view: Release) => view.unmount() },
        {
          name: 'the trigger is disabled',
          release: (view: Release) => (view.enabled.value = false),
        },
        {
          name: 'KeepAlive deactivates the trigger',
          release: (view: Release) => void view.toggle(false),
        },
        {
          name: 'the popup closes for another reason',
          release: (view: Release) =>
            view.getStore().setOpen(false, createChangeEventDetails(REASONS.escapeKey)),
        },
      ])('removes the listener when $name', async ({ release }) => {
        const enabled = shallowRef(true);
        const { App, getStore } = createHoverApp({ handleClose, enabled });
        const view = await renderInKeepAlive(App);
        await enter(getTrigger());
        await flushMicrotasks();
        const listeners = trackDocumentMousemoveListeners();
        await fireEvent.mouseLeave(getTrigger(), { clientX: 100, clientY: 50 });
        expect(listeners()).toBe(1);

        release({ ...view, enabled, getStore });
        await flushMicrotasks();

        expect(listeners()).toBe(0);
      });

      type Release = Awaited<ReturnType<typeof renderInKeepAlive>> & {
        enabled: ShallowRef<boolean>;
        getStore: () => FloatingRootStore;
      };

      it('restores the pointer events that the popup blocks when the pointer leaves the polygon', async () => {
        const { App, getStore } = createHoverApp({
          handleClose: () => safePolygon({ blockPointerEvents: true }),
        });
        await render(<App />);
        await enter(getTrigger());
        await flushMicrotasks();
        // The interaction of the popup blocks the pointer events while a hover popup is open.
        getHoverIntent(getStore()).blockOutsidePointerEventsForPopup(
          getTrigger(),
          screen.getByTestId('popup'),
          null,
          null,
        );
        expect(document.body.style.pointerEvents).toBe('none');

        await fireEvent.mouseLeave(getTrigger(), { clientX: 100, clientY: 50 });
        await moveOnDocument(150, 400);
        await tick(50);

        expect(isOpen()).toBe(false);
        expect(document.body.style.pointerEvents).toBe('');
      });

      it('keeps the options of the active trigger when an inactive trigger gives its own', async () => {
        const { App, getStore } = createHoverApp({
          handleClose: () => safePolygon({ blockPointerEvents: true }),
        });
        const Inactive = defineComponent({
          setup() {
            useHoverTriggerInteraction(getStore(), {
              handleClose: () => safePolygon({ blockPointerEvents: false }),
              isActiveTrigger: false,
            });
            return () => null;
          },
        });

        await render(
          <>
            <App />
            <Inactive />
          </>,
        );

        expect(getHoverIntent(getStore()).handleCloseOptions?.blockPointerEvents).toBe(true);
      });
    });

    it('moves the popup to the second trigger and does not close it on the way', async () => {
      const { App, calls } = createHoverApp({ secondTrigger: true });
      await render(<App />);
      const second = screen.getByTestId('second');
      await enter(getTrigger());

      await fireEvent.mouseLeave(getTrigger(), { relatedTarget: second });
      await enter(second);

      expect(calls.map((call) => [call.open, call.trigger])).toEqual([
        [true, 'trigger'],
        [true, 'second'],
      ]);
    });

    it('VUE-25: opens for the innermost trigger that contains the target', async () => {
      const triggers: (string | undefined)[] = [];
      const App = defineComponent({
        setup() {
          const outer = shallowRef<HTMLElement | null>(null);
          const inner = shallowRef<HTMLElement | null>(null);
          const { context } = useFloating({
            onOpenChange: (_open, details) => triggers.push(details.trigger?.id),
          });
          const hoverProps = useHoverTriggerInteraction(context.rootStore);
          // The inner trigger mounts after the outer trigger, so it registers after it.
          onMounted(() => {
            context.rootStore.context.triggerElements.add('outer', outer.value!);
            context.rootStore.context.triggerElements.add('inner', inner.value!);
          });
          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button id="outer" {...hoverProps} ref={outer}>
                <span id="inner" ref={inner}>
                  <b data-testid="content" />
                </span>
              </button>
            </div>
          );
        },
      });
      await render(<App />);

      await fireEvent.mouseMove(screen.getByTestId('content'));

      expect(triggers).toEqual(['inner']);
    });

    it.each([
      { name: 'leaves the trigger', guard: true, to: () => document.body, timers: 0 },
      { name: 'stays in the trigger', guard: true, to: () => getTrigger(), timers: 1 },
      { name: 'leaves it with no guard', guard: false, to: () => document.body, timers: 1 },
    ])('a mouseout that $name leaves $timers open delays', async (row) => {
      const { App } = createHoverApp({ delay: 500, guardStaleOpen: row.guard });
      await render(<App />);
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());

      await fireEvent.mouseOut(getTrigger(), { relatedTarget: row.to() });

      expect(vi.getTimerCount()).toBe(timersAfterMount + row.timers);
    });

    it.each([
      { name: 'at once', options: {}, wait: 0 },
      { name: 'after an open delay', options: { delay: 500 }, wait: 500 },
      { name: 'after a rest', options: { restMs: 100 }, wait: 100 },
    ])('does not open $name when shouldOpen gives false', async (row) => {
      const { App } = createHoverApp({ ...row.options, shouldOpen: () => false });
      await render(<App />);

      await enter(getTrigger());
      await fireEvent.mouseMove(getTrigger());
      await tick(row.wait);

      expect(isOpen()).toBe(false);
    });

    it('stops the open delay of the old store when the store changes', async () => {
      const { App, second, opened } = createStoreChangeApp({ delay: 500 });
      await render(<App />);
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      second.value = true;
      await flushMicrotasks();
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      expect(opened).toEqual([]);
    });

    it('stops the open delay when the store of a popup root drops a close request', async () => {
      const store = new PopupFixtureStore({});
      const App = defineComponent({
        setup() {
          const hoverProps = useHoverTriggerInteraction(store, { delay: 500 });
          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button data-testid="trigger" {...hoverProps} />
            </div>
          );
        },
      });
      await render(<App />);
      const timersAfterMount = vi.getTimerCount();
      await enter(getTrigger());
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      // The popup is closed, so the store drops the request and tells the hover interaction.
      store.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      expect(store.select('open')).toBe(false);
    });
  });
});
