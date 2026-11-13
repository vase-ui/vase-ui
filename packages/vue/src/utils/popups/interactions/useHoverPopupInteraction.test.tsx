import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, Teleport, defineComponent, shallowRef } from 'vue';
import type { CSSProperties, PropType } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { provideFloatingNode, provideFloatingTree, useFloatingNodeId } from '../tree/FloatingTree';
import { getHoverIntent } from './hoverIntent';
import { useHoverPopupInteraction } from './useHoverPopupInteraction';
import type { UseHoverPopupInteractionProps } from './useHoverPopupInteraction';
import { useHoverTriggerInteraction } from './useHoverTriggerInteraction';

describe('useHoverPopupInteraction', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const App = defineComponent({
    props: { closeDelay: { type: Number, default: undefined } },
    setup(props) {
      const open = shallowRef(false);
      const { refs, context } = useFloating({
        open,
        onOpenChange(nextOpen) {
          open.value = nextOpen;
        },
      });
      const referenceProps = useHoverTriggerInteraction(context.rootStore, {
        triggerElement: refs.reference,
        delay: () => ({ close: props.closeDelay }),
      });
      useHoverPopupInteraction(context.rootStore, { closeDelay: () => props.closeDelay });

      return () => (
        <>
          <button {...referenceProps} ref={refs.setReference} />
          {open.value && <div role="tooltip" ref={refs.setFloating} />}
        </>
      );
    },
  });

  async function tick(ms: number) {
    vi.advanceTimersByTime(ms);
    await flushMicrotasks();
  }

  it('closes after the close delay when the pointer leaves the floating element', async () => {
    await render(<App closeDelay={100} />);

    const button = screen.getByRole('button');
    await fireEvent.mouseEnter(button);
    await flushMicrotasks();

    const tooltip = screen.getByRole('tooltip');
    await fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));
    await fireEvent.mouseEnter(tooltip);
    await fireEvent.mouseLeave(tooltip);

    await tick(99);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await tick(1);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the popup open when the floating element is entered before closeDelay elapses', async () => {
    await render(<App closeDelay={500} />);

    const button = screen.getByRole('button');
    await fireEvent.mouseEnter(button);
    await flushMicrotasks();

    const tooltip = screen.getByRole('tooltip');
    await fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));

    await tick(499);

    await fireEvent.mouseEnter(tooltip);

    await tick(500);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await fireEvent.mouseLeave(tooltip);

    await tick(499);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await tick(1);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  describe('rules with no Base UI case', () => {
    afterEach(() => {
      document.body.style.removeProperty('pointer-events');
    });

    // The browser keeps its real pointer where an earlier test left it. An element under that
    // pointer gets trusted events in a later frame. Each app of this block renders in a wrapper
    // with this style. A dispatched event still reaches the listeners.
    const NO_POINTER_EVENTS: CSSProperties = { pointerEvents: 'none' };

    const isOpen = (name = 'popup') => screen.queryByTestId(name) !== null;

    function openByHover(store: FloatingRootStore) {
      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter')),
      );
      return flushMicrotasks();
    }

    function closeByEscape(store: FloatingRootStore) {
      store.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
      return flushMicrotasks();
    }

    // A popup with no trigger interaction, so only the interaction of the popup answers to the
    // pointer. The case opens it with a hover event. It has a button that opens a popup and a
    // button that does not.
    function createPopupApp(options: UseHoverPopupInteractionProps = {}) {
      let store!: FloatingRootStore;

      const PopupApp = defineComponent({
        setup() {
          const open = shallowRef(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange(nextOpen) {
              open.value = nextOpen;
            },
          });
          store = context.rootStore;
          useHoverPopupInteraction(store, options);

          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button data-testid="trigger" ref={refs.setReference} />
              {open.value && (
                <div data-testid="popup" ref={refs.setFloating}>
                  <button data-testid="menu-button" aria-haspopup="menu" />
                  <button data-testid="button" />
                </div>
              )}
            </div>
          );
        },
      });

      return { PopupApp, getStore: () => store };
    }

    // `KeepAlive` deactivates the app while `Other` shows. It does not unmount the app.
    const Other = defineComponent({ setup: () => () => <p>other</p> });

    async function renderInKeepAlive(PopupApp: ReturnType<typeof createPopupApp>['PopupApp']) {
      const show = shallowRef(true);
      const { unmount } = await render(() => (
        <KeepAlive>{show.value ? <PopupApp key="app" /> : <Other key="other" />}</KeepAlive>
      ));
      return {
        unmount,
        async toggle(visible: boolean) {
          show.value = visible;
          await flushMicrotasks();
        },
      };
    }

    it('reads the close delay when the pointer leaves the popup', async () => {
      const closeDelay = shallowRef(100);
      const { PopupApp, getStore } = createPopupApp({ closeDelay });
      await render(<PopupApp />);
      await openByHover(getStore());
      closeDelay.value = 300;
      await flushMicrotasks();

      await fireEvent.mouseLeave(screen.getByTestId('popup'));
      await tick(299);
      expect(isOpen()).toBe(true);

      await tick(1);
      expect(isOpen()).toBe(false);
    });

    it('does not listen to the popup while it is disabled', async () => {
      const { PopupApp, getStore } = createPopupApp({ enabled: false });
      await render(<PopupApp />);
      await openByHover(getStore());

      await fireEvent.mouseLeave(screen.getByTestId('popup'));
      await tick(1000);

      expect(isOpen()).toBe(true);
    });

    it('listens to the popup when it gets enabled', async () => {
      const enabled = shallowRef(false);
      const { PopupApp, getStore } = createPopupApp({ enabled });
      await render(<PopupApp />);
      await openByHover(getStore());
      enabled.value = true;
      await flushMicrotasks();

      await fireEvent.mouseLeave(screen.getByTestId('popup'));

      expect(isOpen()).toBe(false);
    });

    it.each([
      { name: 'a button that opens a popup', target: 'menu-button', open: true },
      { name: 'a button', target: 'button', open: false },
    ])('after a press on $name, a leave keeps the popup open: $open', async (row) => {
      const { PopupApp, getStore } = createPopupApp();
      await render(<PopupApp />);
      await openByHover(getStore());

      await fireEvent.pointerDown(screen.getByTestId(row.target));
      await fireEvent.mouseLeave(screen.getByTestId('popup'));
      await tick(1000);

      expect(isOpen()).toBe(row.open);
    });

    it('forgets a press in the popup when the popup closes', async () => {
      const { PopupApp, getStore } = createPopupApp();
      await render(<PopupApp />);
      await openByHover(getStore());
      await fireEvent.pointerDown(screen.getByTestId('menu-button'));

      await closeByEscape(getStore());
      await openByHover(getStore());
      await fireEvent.mouseLeave(screen.getByTestId('popup'));

      expect(isOpen()).toBe(false);
    });

    it('stops the open delay of a trigger when the popup unmounts', async () => {
      const showPopup = shallowRef(true);
      const calls: boolean[] = [];
      let store!: FloatingRootStore;

      const PopupPart = defineComponent({
        setup() {
          useHoverPopupInteraction(store);
          return () => null;
        },
      });
      const TimerApp = defineComponent({
        setup() {
          const { refs, context } = useFloating({
            onOpenChange: (nextOpen) => calls.push(nextOpen),
          });
          store = context.rootStore;
          const hoverProps = useHoverTriggerInteraction(store, {
            delay: 500,
            triggerElement: refs.reference,
          });
          return () => (
            <div style={NO_POINTER_EVENTS}>
              <button data-testid="trigger" {...hoverProps} ref={refs.setReference} />
              {showPopup.value && <PopupPart />}
            </div>
          );
        },
      });
      await render(<TimerApp />);
      const timersAfterMount = vi.getTimerCount();
      await fireEvent.mouseEnter(screen.getByTestId('trigger'));
      expect(vi.getTimerCount()).toBe(timersAfterMount + 1);

      showPopup.value = false;
      await flushMicrotasks();
      expect(vi.getTimerCount()).toBe(timersAfterMount);

      await tick(1000);
      expect(calls).toEqual([]);
    });

    describe('pointer events', () => {
      const BLOCKED = { body: 'none', trigger: 'auto', positioner: 'auto' };
      const RELEASED = { body: '', trigger: '', positioner: '' };

      // The popup is open by hover. With `block`, the active trigger gave `blockPointerEvents` to
      // the hover intent, as the safe polygon of the trigger does.
      async function renderOpenPopup({
        block = true,
        ...options
      }: UseHoverPopupInteractionProps & { block?: boolean } = {}) {
        const { PopupApp, getStore } = createPopupApp(options);
        const view = await renderInKeepAlive(PopupApp);
        if (block) {
          getHoverIntent(getStore()).handleCloseOptions = { blockPointerEvents: true };
        }
        await openByHover(getStore());
        const trigger = screen.getByTestId('trigger');
        const positioner = screen.getByTestId('popup');
        return {
          ...view,
          trigger,
          positioner,
          getStore,
          read: () => ({
            body: document.body.style.pointerEvents,
            trigger: trigger.style.pointerEvents,
            positioner: positioner.style.pointerEvents,
          }),
        };
      }

      it('blocks them outside the popup and its trigger while the popup is open', async () => {
        const { read } = await renderOpenPopup();

        expect(read()).toEqual(BLOCKED);
      });

      it('gives them back when it gets disabled', async () => {
        const enabled = shallowRef(true);
        const { read } = await renderOpenPopup({ enabled });

        enabled.value = false;
        await flushMicrotasks();

        expect(read()).toEqual(RELEASED);
      });

      it('gives them back while KeepAlive holds the popup, and blocks them at the activation', async () => {
        const { read, toggle } = await renderOpenPopup();

        await toggle(false);
        expect(read()).toEqual(RELEASED);

        await toggle(true);
        expect(read()).toEqual(BLOCKED);
      });

      it('gives them back when the popup unmounts, also when a trigger blocked them', async () => {
        const { read, unmount, trigger, positioner, getStore } = await renderOpenPopup({
          block: false,
        });
        getHoverIntent(getStore()).blockOutsidePointerEvents({
          scopeElement: document.body,
          triggerElement: trigger,
          positionerElement: positioner,
        });
        expect(read()).toEqual(BLOCKED);

        unmount();

        expect(read()).toEqual(RELEASED);
      });
    });

    it('removes the listeners of the popup while KeepAlive holds it, and adds them back', async () => {
      const { PopupApp, getStore } = createPopupApp();
      const view = await renderInKeepAlive(PopupApp);
      await openByHover(getStore());
      const popup = screen.getByTestId('popup');

      await view.toggle(false);
      await fireEvent.mouseLeave(popup);
      expect(getStore().select('open')).toBe(true);

      await view.toggle(true);
      await fireEvent.mouseLeave(popup);
      expect(getStore().select('open')).toBe(false);
    });

    describe('the popup tree', () => {
      const stores: Record<string, FloatingRootStore> = {};

      // The popup part. A family puts it below the node of its popup.
      const LayerPopup = defineComponent({
        props: { store: { type: Object as PropType<FloatingRootStore>, required: true } },
        setup(props) {
          useHoverPopupInteraction(props.store);
          return () => null;
        },
      });

      // A popup that has a node in the popup tree. The popup below it renders in its slot. Its
      // element is in `<body>`, so it is not in the element of this popup.
      const Layer = defineComponent({
        props: { name: { type: String, required: true } },
        setup(props, { slots }) {
          const nodeId = useFloatingNodeId();
          const open = shallowRef(false);
          const { refs, context } = useFloating({
            open,
            nodeId,
            onOpenChange(nextOpen) {
              open.value = nextOpen;
            },
          });
          stores[props.name] = context.rootStore;
          provideFloatingNode(nodeId);

          return () =>
            open.value && (
              <Teleport to="body">
                <div data-testid={props.name} ref={refs.setFloating}>
                  <LayerPopup store={context.rootStore} />
                  {slots.default?.()}
                </div>
              </Teleport>
            );
        },
      });

      const Tree = defineComponent({
        setup(_, { slots }) {
          provideFloatingTree();
          return () => slots.default?.();
        },
      });

      async function renderLayers(withTree = true) {
        const layers = (
          <Layer name="parent">
            <Layer name="child" />
          </Layer>
        );
        await render(withTree ? <Tree>{layers}</Tree> : layers);
        await openByHover(stores.parent);
        await openByHover(stores.child);
        return { parent: screen.getByTestId('parent'), child: screen.getByTestId('child') };
      }

      it.each([
        { name: 'a tree', withTree: true, open: true },
        { name: 'no tree', withTree: false, open: false },
      ])('a leave into the popup below it with $name keeps it open: $open', async (row) => {
        const { parent, child } = await renderLayers(row.withTree);

        await fireEvent.mouseLeave(parent, { relatedTarget: child });
        await tick(1000);

        expect(isOpen('parent')).toBe(row.open);
      });

      it('closes after the popup below it closes, when the pointer left it', async () => {
        const { parent, child } = await renderLayers();

        await fireEvent.mouseLeave(parent);
        await tick(1000);
        expect(isOpen('parent')).toBe(true);

        await fireEvent.mouseLeave(child);
        await tick(0);

        expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
          parent: false,
          child: false,
        });
      });

      it('stays open when the pointer enters it before the popup below it closes', async () => {
        const { parent, child } = await renderLayers();
        await fireEvent.mouseLeave(parent);
        await fireEvent.mouseLeave(child);

        await fireEvent.mouseEnter(parent);
        await tick(1000);

        expect(isOpen('parent')).toBe(true);
      });

      it('stops the close that waits for the popup below it when KeepAlive deactivates it', async () => {
        const show = shallowRef(true);
        await render(() => (
          <KeepAlive>
            {show.value ? (
              <Tree key="tree">
                <Layer name="parent">
                  <Layer name="child" />
                </Layer>
              </Tree>
            ) : (
              <Other key="other" />
            )}
          </KeepAlive>
        ));
        await openByHover(stores.parent);
        await openByHover(stores.child);
        const timersAfterOpen = vi.getTimerCount();
        await fireEvent.mouseLeave(screen.getByTestId('parent'));
        await fireEvent.mouseLeave(screen.getByTestId('child'));
        expect(vi.getTimerCount()).toBe(timersAfterOpen + 1);

        show.value = false;
        await flushMicrotasks();
        expect(vi.getTimerCount()).toBe(timersAfterOpen);

        await tick(1000);
        expect(isOpen('parent')).toBe(true);
      });

      it('uses the node id option for a leave into a closed popup below it', async () => {
        let store!: FloatingRootStore;
        // A closed popup that stays mounted. Its node is in the tree, and its element is in `<body>`.
        const ClosedChild = defineComponent({
          setup() {
            const nodeId = useFloatingNodeId();
            const { refs } = useFloating({ open: false, nodeId });
            return () => (
              <Teleport to="body">
                <div data-testid="child" ref={refs.setFloating} />
              </Teleport>
            );
          },
        });
        // The positioning context of this popup has no node id, so the option must give it.
        const Parent = defineComponent({
          setup() {
            const nodeId = useFloatingNodeId();
            const open = shallowRef(false);
            const { refs, context } = useFloating({
              open,
              onOpenChange(nextOpen) {
                open.value = nextOpen;
              },
            });
            store = context.rootStore;
            provideFloatingNode(nodeId);
            useHoverPopupInteraction(store, { nodeId: () => nodeId });

            return () =>
              open.value && (
                <div data-testid="parent" ref={refs.setFloating}>
                  <ClosedChild />
                </div>
              );
          },
        });
        await render(
          <Tree>
            <Parent />
          </Tree>,
        );
        await openByHover(store);

        await fireEvent.mouseLeave(screen.getByTestId('parent'), {
          relatedTarget: screen.getByTestId('child'),
        });
        await tick(1000);

        expect(isOpen('parent')).toBe(true);
      });
    });
  });
});
