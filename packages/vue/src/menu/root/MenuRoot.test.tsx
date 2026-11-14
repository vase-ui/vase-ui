import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, onMounted, shallowRef } from 'vue';
import type { ComponentPublicInstance, PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import { reset as resetWarnings } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useTriggerRegistration } from '../../utils/popups/popupStoreUtils';
import { provideFloatingNode, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import * as Menu from '../index.parts';
import type { MenuStore } from '../store/MenuStore';
import { useMenuRootContext } from './MenuRootContext';
import type { MenuRootContext } from './MenuRootContext';
import MenuRootHydration from './MenuRootHydration.test.vue';
import { useMenuRoot } from './useMenuRoot';
import type { UseMenuRootOptions } from './useMenuRoot';

type PartProps = Record<string, unknown>;

const testMenuProps = {
  rootProps: { type: Object as PropType<PartProps>, default: undefined },
  omitTrigger: { type: Boolean, default: false },
};

const ContainedTriggerMenu = defineComponent({
  props: testMenuProps,
  setup(props) {
    return () => (
      <Menu.Root {...props.rootProps}>
        {!props.omitTrigger ? <Menu.Trigger>Toggle</Menu.Trigger> : null}
        <Menu.Portal>
          <Menu.Positioner data-testid="menu-positioner">
            <Menu.Popup data-testid="menu">
              <Menu.Item data-testid="item-1">Item 1</Menu.Item>
              <Menu.Item data-testid="item-2">Item 2</Menu.Item>
              <Menu.Item data-testid="item-3" disabled>
                Item 3
              </Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger">Item 4</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item data-testid="item-4_1">Item 4.1</Menu.Item>
                      <Menu.Item data-testid="item-4_2">Item 4.2</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
              <Menu.Item data-testid="item-5">Item 5</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  },
});

const DetachedTriggerMenu = defineComponent({
  props: testMenuProps,
  setup(props) {
    const menuHandle = Menu.createHandle();

    return () => (
      <>
        <ContainedTriggerMenu rootProps={{ ...props.rootProps, handle: menuHandle }} omitTrigger />
        <Menu.Trigger handle={menuHandle}>Toggle</Menu.Trigger>
      </>
    );
  },
});

/** Reads the context and the tree that a part below a root gets. */
function createProbe() {
  const contexts: MenuRootContext[] = [];
  const trees: Array<FloatingTreeType | null> = [];
  const Probe = defineComponent({
    setup() {
      contexts.push(useMenuRootContext());
      trees.push(useFloatingTree().value);
      return () => null;
    },
  });

  return {
    Probe,
    trees,
    get context() {
      return contexts[0];
    },
    get store() {
      return contexts[0].store;
    },
  };
}

/** A root part that calls `useMenuRoot` with the given options, as `Menu.SubmenuRoot` does. */
function createRootPart(options: Partial<UseMenuRootOptions> = {}) {
  return defineComponent({
    setup(_, { slots }) {
      useMenuRoot(
        {},
        { onOpenChange() {}, onOpenChangeComplete() {}, onItemHighlighted() {}, ...options },
      );
      return () => slots.default?.();
    },
  });
}

const TestTrigger = defineComponent({
  props: { id: { type: String, required: true } },
  setup(props) {
    const { store } = useMenuRootContext();
    const { registerTrigger } = useTriggerRegistration(() => props.id, store);
    const isActive = computed(() => store.select('isTriggerActive', props.id));
    const setElement = (element: Element | ComponentPublicInstance | null) => {
      registerTrigger(element as Element | null);
    };

    return () => (
      <button id={props.id} {...store.select('triggerProps', isActive.value)} ref={setElement} />
    );
  },
});

const TestPopup = defineComponent({
  props: { onKeydown: Function as PropType<(event: KeyboardEvent) => void> },
  setup(props) {
    const { store } = useMenuRootContext();
    const setElement = (element: Element | ComponentPublicInstance | null) => {
      store.context.popupRef.value = element as HTMLElement | null;
      store.set('popupElement', element as HTMLElement | null);
    };

    return () =>
      store.select('mounted') ? (
        <div
          data-testid="popup"
          onKeydown={props.onKeydown}
          {...store.select('popupProps')}
          ref={setElement}
        />
      ) : null;
  },
});

const imperativeActionDetails = () => createChangeEventDetails(REASONS.imperativeAction);

// The real pointer of the browser can rest on an element. A dispatched event still reaches the
// element, and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

function useFakeTimers() {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('<Menu.Root />', () => {
  const { render } = createRenderer();

  it('starts a tree when no menu is above it', async () => {
    const probe = createProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
      </Menu.Root>,
    );

    const tree = probe.store.state.floatingTreeRoot;
    expect(probe.trees).toHaveLength(1);
    expect(probe.trees[0]).toBe(tree);
    expect(tree.nodesRef.value.map((node) => node.id)).toEqual([probe.store.state.floatingNodeId]);
    expect(probe.store.state.floatingParentNodeId).toBe(null);
  });

  it('a root in the slot of a root is not a submenu', async () => {
    const probe = createProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
        <Menu.Root>
          <probe.Probe />
        </Menu.Root>
      </Menu.Root>,
    );

    expect(probe.trees).toHaveLength(2);
    expect(probe.trees[0]).not.toBe(null);
    expect(probe.trees[1]).not.toBe(null);
    expect(probe.trees[1]).not.toBe(probe.trees[0]);
    expect(probe.store.state.parent.type).toBe(undefined);
  });

  it('reads the state of its parent menu when it is a submenu', async () => {
    const parent = createProbe();
    const submenu = createProbe();
    const Submenu = createRootPart({ isSubmenu: true });
    const ParentNode = defineComponent({
      setup(_, { slots }) {
        provideFloatingNode('parent-node');
        return () => slots.default?.();
      },
    });

    await render(
      <Menu.Root>
        <parent.Probe />
        <ParentNode>
          <Submenu>
            <submenu.Probe />
          </Submenu>
        </ParentNode>
      </Menu.Root>,
    );

    expect(submenu.store.state.parent.type).toBe('menu');
    expect(submenu.store.select('rootId')).toBe(parent.store.select('rootId'));
    expect(submenu.store.select('floatingTreeRoot')).toBe(parent.store.state.floatingTreeRoot);
    expect(parent.store.state.floatingTreeRoot.nodesRef.value).toHaveLength(2);
    expect(submenu.store.state.floatingParentNodeId).toBe('parent-node');
    expect(submenu.store.select('modal')).toBe(false);
    expect(submenu.store.context.allowMouseUpTriggerRef).toBe(
      parent.store.context.allowMouseUpTriggerRef,
    );
    expect(submenu.trees[0]).toBe(parent.trees[0]);
  });

  it('gives the orientation, the loop and the escape of the options to its parts', async () => {
    const orientation = shallowRef<'horizontal' | undefined>(undefined);
    const loopFocus = shallowRef<boolean | undefined>(undefined);
    const probe = createProbe();
    await render(() => (
      <Menu.Root orientation={orientation.value} loopFocus={loopFocus.value}>
        <probe.Probe />
      </Menu.Root>
    ));
    const { context } = probe;

    expect(context.orientation.value).toBe('vertical');
    expect(context.loopFocus.value).toBe(true);
    expect(context.allowEscape.value).toBe(true);

    orientation.value = 'horizontal';
    loopFocus.value = false;
    await flushMicrotasks();

    expect(context.orientation.value).toBe('horizontal');
    expect(context.loopFocus.value).toBe(false);

    const allowEscape = shallowRef(false);
    const optionsProbe = createProbe();
    const RootPart = createRootPart({ allowEscape });
    await render(
      <RootPart>
        <optionsProbe.Probe />
      </RootPart>,
    );

    expect(optionsProbe.context.allowEscape.value).toBe(false);

    allowEscape.value = true;

    expect(optionsProbe.context.allowEscape.value).toBe(true);
  });

  it('gives the virtual focus of its options to its context and to a submenu', async () => {
    const virtualFocusRef = shallowRef<HTMLElement | null>(null);
    const plain = createProbe();
    const virtual = createProbe();
    const submenu = createProbe();
    const VirtualFocusRoot = createRootPart({ virtualFocus: true, virtualFocusRef });
    const Submenu = createRootPart({ isSubmenu: true });
    await render(
      <div>
        <Menu.Root>
          <plain.Probe />
        </Menu.Root>
        <VirtualFocusRoot>
          <virtual.Probe />
          <Submenu>
            <submenu.Probe />
          </Submenu>
        </VirtualFocusRoot>
      </div>,
    );

    expect(plain.context.virtualFocus).toBe(false);
    expect(plain.context.parentVirtualFocus).toBe(false);
    expect(plain.store.context.virtualFocusRef).toBe(undefined);
    expect(virtual.context.virtualFocus).toBe(true);
    expect(virtual.context.parentVirtualFocus).toBe(false);
    expect(virtual.store.context.virtualFocusRef).toBe(virtualFocusRef);
    expect(submenu.context.virtualFocus).toBe(false);
    expect(submenu.context.parentVirtualFocus).toBe(true);
  });

  describe('open state', () => {
    it('emits openChange and then update:open', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <probe.Probe />
        </Menu.Root>,
      );

      probe.store.setOpen(true, imperativeActionDetails());

      expect(events).toEqual([
        ['openChange', true, 'imperative-action'],
        ['update:open', true],
      ]);
    });

    it('does not emit update:open after cancel()', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          defaultOpen
          onOpenChange={(open, details) => {
            events.push(['openChange', open]);
            details.cancel();
          }}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <probe.Probe />
        </Menu.Root>,
      );

      probe.store.setOpen(false, imperativeActionDetails());

      expect(events).toEqual([['openChange', false]]);
      expect(probe.store.state.open).toBe(true);
    });

    it('follows v-model:open', async () => {
      const open = shallowRef(false);
      const probe = createProbe();
      const { getByRole } = await render(() => (
        <Menu.Root
          open={open.value}
          triggerId="trigger"
          onUpdate:open={(nextOpen) => {
            open.value = nextOpen;
          }}
        >
          <probe.Probe />
          <TestTrigger id="trigger" />
        </Menu.Root>
      ));
      const trigger = getByRole('button');

      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      open.value = true;
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      probe.store.setOpen(false, imperativeActionDetails());
      await flushMicrotasks();

      expect(open.value).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes with Escape and marks the close as instant', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByRole } = await render(
        <Menu.Root
          defaultOpen
          defaultTriggerId="trigger"
          onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => events.push(['update:open', open])}
          onOpenChangeComplete={(open) => events.push(['openChangeComplete', open])}
        >
          <probe.Probe />
          <TestTrigger id="trigger" />
          <TestPopup />
        </Menu.Root>,
      );
      const trigger = getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(events).toContainEqual(['openChangeComplete', false]);
      });

      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
        ['openChangeComplete', false],
      ]);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(probe.store.select('instantType')).toBe('dismiss');
    });

    it('does not close for Escape while it is disabled', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root defaultOpen disabled onOpenChange={(open) => events.push(open)}>
          <probe.Probe />
        </Menu.Root>,
      );

      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(events).toEqual([]);
      expect(probe.store.state.open).toBe(true);
    });

    it('closes for a press outside, and stays open for a press in the popup', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <Menu.Root
            defaultOpen
            onOpenChange={(open, details) =>
              events.push([open, details.reason, details.event.type])
            }
          >
            <probe.Probe />
            <TestPopup />
          </Menu.Root>
        </div>,
      );

      await fireEvent.pointerDown(getByTestId('popup'), { pointerType: 'mouse' });

      expect(events).toEqual([]);

      await fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      expect(events).toEqual([[false, 'outside-press', 'pointerdown']]);
    });

    it('exposes close and unmount', async () => {
      const events: unknown[] = [];
      let root!: ComponentPublicInstance;
      await render(() => (
        <Menu.Root
          ref={(instance) => {
            root = instance as ComponentPublicInstance;
          }}
          defaultOpen
          onOpenChange={(open, details) => events.push([open, details.reason])}
        />
      ));

      expect(Object.keys(root).sort()).toEqual(['close', 'unmount']);

      (root as unknown as { close(): void }).close();

      expect(events).toEqual([[false, 'imperative-action']]);
    });
  });

  describe('open change requests', () => {
    it('drops a request that comes before the root is mounted', async () => {
      const events: unknown[] = [];
      let store!: MenuStore<unknown>;
      const RequestWhenMounted = defineComponent({
        setup() {
          store = useMenuRootContext().store;
          onMounted(() => {
            store.setOpen(true, imperativeActionDetails());
          });
          return () => null;
        },
      });

      await render(
        <Menu.Root onOpenChange={(open) => events.push(open)}>
          <RequestWhenMounted />
        </Menu.Root>,
      );

      expect(events).toEqual([]);
      expect(store.state.open).toBe(false);
    });

    it('reports two equal open requests of one tick', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle} onOpenChange={(open) => events.push(open)}>
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );

      handle.open('trigger');
      handle.open('trigger');

      expect(events).toEqual([true, true]);
    });

    it('drops a request that is equal to the rendered state', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle} onOpenChange={(open) => events.push(open)}>
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );
      handle.open('trigger');
      await flushMicrotasks();

      handle.open('trigger');

      expect(events).toEqual([true]);
      expect(handle.isOpen).toBe(true);
    });

    it('drops a request that comes after the unmount', async () => {
      const probe = createProbe();
      const { unmount } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
        </Menu.Root>,
      );
      const { store } = probe;

      unmount();
      store.setOpen(false, imperativeActionDetails());

      expect(store.state.open).toBe(true);
    });
  });

  describe('handle', () => {
    it('opens and closes from the handle and reports isOpen', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle<number>();
      await render(
        <Menu.Root
          handle={handle}
          onOpenChange={(open, details) => events.push([open, details.reason, details.trigger?.id])}
        >
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );

      expect(handle.isOpen).toBe(false);

      handle.open('trigger');
      expect(handle.isOpen).toBe(true);
      await flushMicrotasks();

      handle.close();
      handle.close();
      expect(handle.isOpen).toBe(false);

      expect(events).toEqual([
        [true, 'imperative-action', 'trigger'],
        [false, 'imperative-action', 'trigger'],
      ]);
    });

    it('throws when open() names no registered trigger', async () => {
      const handle = Menu.createHandle();
      await render(<Menu.Root handle={handle} />);

      expect(() => handle.open('missing')).toThrow(/Vase UI: MenuHandle\.open\(\)/);
    });
  });

  it('gives the id that the popup registers to the store', async () => {
    const probe = createProbe();
    await render(
      <Menu.Root>
        <probe.Probe />
      </Menu.Root>,
    );
    const { context, store } = probe;
    const generated = context.generatedPopupId;

    expect(store.select('popupId')).toBe(generated);
    expect(store.select('defaultPopupId')).toBe(generated);

    context.setRenderedPopupId('custom');
    await flushMicrotasks();

    expect(store.select('popupId')).toBe('custom');
    expect(store.select('defaultPopupId')).toBe('custom');

    context.setRenderedPopupId('');
    await flushMicrotasks();

    expect(store.select('popupId')).toBe(undefined);
    expect(store.select('defaultPopupId')).toBe(undefined);

    context.setRenderedPopupId(undefined);
    await flushMicrotasks();

    expect(store.select('popupId')).toBe(generated);
    expect(store.select('defaultPopupId')).toBe(generated);
  });

  describe('itemHighlighted', () => {
    function createItems(...ids: string[]) {
      return ids.map((id) => {
        const element = document.createElement('div');
        element.id = id;
        document.body.append(element);
        onTestFinished(() => {
          element.remove();
        });
        return element;
      });
    }

    it('reports the item after the DOM update, with the reason, the event and the label', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          onItemHighlighted={(item, details) =>
            events.push([item?.id, details.reason, details.label, details.event.type])
          }
        >
          <probe.Probe />
        </Menu.Root>,
      );
      const { store } = probe;
      store.context.itemDomElements.value = createItems('first', 'second');
      store.context.itemLabels.value = ['First', 'Second'];

      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));

      expect(events).toEqual([]);

      await flushMicrotasks();

      expect(events).toEqual([['second', 'keyboard', 'Second', 'keydown']]);

      store.setActiveIndex(null, 'none');
      await flushMicrotasks();

      expect(events[1]).toEqual([undefined, 'none', undefined, 'vase-ui']);
    });

    it('reports nothing when the registry settles with the same item', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item) => events.push(item?.id)}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      store.context.itemDomElements.value = createItems('first', 'second');
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      context.syncHighlightedItem();

      expect(events).toEqual(['second']);

      store.setActiveIndex(0, 'keyboard', new KeyboardEvent('keydown'));
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      expect(events).toEqual(['second']);
    });

    it('reports another element at the same index with the reason none', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item, details) => events.push([item?.id, details.reason])}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      const [first, second, third] = createItems('first', 'second', 'third');
      store.context.itemDomElements.value = [first, second];
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      store.setActiveIndex(0, 'keyboard', new KeyboardEvent('keydown'));
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      store.context.itemDomElements.value = [first, third];
      context.syncHighlightedItem();

      expect(events).toEqual([
        ['second', 'keyboard'],
        ['third', 'none'],
      ]);
    });

    it('reports nothing for an item that left the document', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item) => events.push(item?.id)}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      const [first, second, removed] = createItems('first', 'second', 'removed');
      store.context.itemDomElements.value = [first, second];
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      removed.remove();
      store.context.itemDomElements.value = [first, removed];
      context.syncHighlightedItem();

      expect(events).toEqual(['second']);
    });

    it('publishes the highlighted item to the store only under virtual focus', async () => {
      const plain = createProbe();
      const virtual = createProbe();
      const VirtualFocusRoot = createRootPart({ virtualFocus: true });
      await render(
        <div>
          <Menu.Root>
            <plain.Probe />
          </Menu.Root>
          <VirtualFocusRoot>
            <virtual.Probe />
          </VirtualFocusRoot>
        </div>,
      );
      const items = createItems('first', 'second');
      for (const { store } of [plain, virtual]) {
        store.context.itemDomElements.value = items;
        store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      }
      await flushMicrotasks();

      expect(virtual.store.state.highlightedItem).toBe(items[1]);
      expect(plain.store.state.highlightedItem).toBe(undefined);
    });
  });

  describe('dismissal', () => {
    // The components of each menu are not in the components of the menu above it, so only the
    // popup tree tells a menu that a press is in a menu below it.
    it('keeps a menu open for a press in a menu that a trigger in its popup opened', async () => {
      const middleHandle = Menu.createHandle();
      const innerHandle = Menu.createHandle();
      const { findByTestId, getByRole, queryByTestId } = await render(
        <div>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Trigger handle={middleHandle} id="middle-trigger">
                    Middle
                  </Menu.Trigger>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root handle={middleHandle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="middle-menu">
                  <Menu.Trigger handle={innerHandle} id="inner-trigger">
                    Inner
                  </Menu.Trigger>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root handle={innerHandle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="inner-menu">
                  <Menu.Item>Beta</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      middleHandle.open('middle-trigger');
      await findByTestId('middle-menu');
      innerHandle.open('inner-trigger');
      await findByTestId('inner-menu');

      await fireEvent.pointerDown(getByRole('menuitem', { name: 'Beta' }));
      await flushMicrotasks();

      expect(queryByTestId('inner-menu')).not.toBe(null);
      expect(queryByTestId('middle-menu')).not.toBe(null);
    });
  });

  describe('popup', () => {
    it('sets allowMouseEnter for a mouse move over the popup, and clears it after the unmount', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup style={noRealPointer} />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(getByTestId('popup')).toHaveAttribute('tabindex', '-1');
      expect(store.state.allowMouseEnter).toBe(false);

      await fireEvent.mouseMove(getByTestId('popup'));

      expect(store.state.allowMouseEnter).toBe(true);

      store.setOpen(false, imperativeActionDetails());
      await waitFor(() => {
        expect(store.state.mounted).toBe(false);
      });

      expect(store.state.allowMouseEnter).toBe(false);
    });

    it('sets allowMouseEnter for a mouse move over the active trigger', async () => {
      const probe = createProbe();
      const { getByRole } = await render(
        <Menu.Root defaultOpen defaultTriggerId="trigger">
          <probe.Probe />
          <TestTrigger id="trigger" style={noRealPointer} />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(store.state.allowMouseEnter).toBe(false);

      await fireEvent.mouseMove(getByRole('button'));

      expect(store.state.allowMouseEnter).toBe(true);
    });

    it.each([
      { name: 'a root with no parent', isSubmenu: false, hoverEnabled: true },
      { name: 'a submenu root', isSubmenu: true, hoverEnabled: false },
    ])(
      'sets hoverEnabled to $hoverEnabled for a mouse move over the popup of $name',
      async ({ isSubmenu, hoverEnabled }) => {
        const probe = createProbe();
        const Part = createRootPart({ isSubmenu });
        const { getByTestId } = await render(
          <Menu.Root>
            <Part>
              <probe.Probe />
              <TestPopup style={noRealPointer} />
            </Part>
          </Menu.Root>,
        );
        const { store } = probe;
        store.setOpen(true, imperativeActionDetails());
        await flushMicrotasks();

        expect(store.state.hoverEnabled).toBe(true);

        await fireEvent.mouseMove(getByTestId('popup'));

        expect(store.state.hoverEnabled).toBe(hoverEnabled);
      },
    );

    it('turns the hover off for a click in the popup, and on again after the close', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(store.state.hoverEnabled).toBe(true);

      await fireEvent.click(getByTestId('popup'));

      expect(store.state.hoverEnabled).toBe(false);

      store.setOpen(false, imperativeActionDetails());
      await flushMicrotasks();

      expect(store.state.hoverEnabled).toBe(true);
    });

    it('gives a key of the popup to the keyboard relay, unless a handler stopped it', async () => {
      const relay = vi.fn();
      let stopKey = false;
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup
            onKeydown={(event: KeyboardEvent) => {
              if (stopKey) {
                event.stopPropagation();
              }
            }}
          />
        </Menu.Root>,
      );
      probe.store.set('keyboardEventRelay', relay);

      await fireEvent.keyDown(getByTestId('popup'), { key: 'a' });

      expect(relay).toHaveBeenCalledTimes(1);
      expect(relay.mock.calls[0][0].key).toBe('a');

      stopKey = true;
      await fireEvent.keyDown(getByTestId('popup'), { key: 'b' });

      expect(relay).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal', () => {
    it('follows the modal prop', async () => {
      const modal = shallowRef<boolean | undefined>(undefined);
      const probe = createProbe();
      await render(() => (
        <Menu.Root modal={modal.value}>
          <probe.Probe />
        </Menu.Root>
      ));

      expect(probe.store.select('modal')).toBe(true);

      modal.value = false;
      await flushMicrotasks();

      expect(probe.store.select('modal')).toBe(false);
    });

    it('follows the disabled prop and the highlightItemOnHover prop', async () => {
      const disabled = shallowRef(false);
      const highlightItemOnHover = shallowRef(true);
      const probe = createProbe();
      await render(() => (
        <Menu.Root disabled={disabled.value} highlightItemOnHover={highlightItemOnHover.value}>
          <probe.Probe />
        </Menu.Root>
      ));

      expect(probe.store.select('disabled')).toBe(false);
      expect(probe.store.select('highlightItemOnHover')).toBe(true);

      disabled.value = true;
      highlightItemOnHover.value = false;
      await flushMicrotasks();

      expect(probe.store.select('disabled')).toBe(true);
      expect(probe.store.select('highlightItemOnHover')).toBe(false);
    });

    it('warns that a menu in a menubar ignores modal={false}', async () => {
      resetWarnings();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => {
        warn.mockRestore();
      });
      const context = createMenubarContext();

      await render(
        <MenubarProvider context={context}>
          <Menu.Root />
          <Menu.Root modal />
        </MenubarProvider>,
      );

      expect(warn).not.toHaveBeenCalled();

      await render(
        <MenubarProvider context={context}>
          <Menu.Root modal={false} />
        </MenubarProvider>,
      );

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^Vase UI: The `modal` prop of <Menu\.Root> is `false`/),
      );
    });
  });

  // All these tests run for contained and detached triggers.
  // The rendered menu has the same structure in most cases.
  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenu },
    { name: 'detached triggers', Component: DetachedTriggerMenu },
  ])('when using $name', ({ Component: TestMenu }) => {
    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('interaction type tracking (openMethod)', () => {
        it('should not apply scroll lock when opened via touch', async () => {
          await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          await fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');

          const doc = menu.ownerDocument;
          // The lock waits for a timer of 0 ms.
          await wait(0);

          expect(isScrollLocked(doc)).toBe(false);
        });

        it('should apply scroll lock when opened via mouse', async () => {
          const { user } = await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const doc = trigger.ownerDocument;

          await user.click(trigger);
          await screen.findByRole('menu');
          // The lock waits for a timer of 0 ms.
          await wait(0);

          expect(isScrollLocked(doc)).toBe(true);
        });
      });

      describe('touch scroll lock', () => {
        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'should apply scroll lock when a touch-opened popup $name covers the viewport width',
          async ({ keepMounted }) => {
            await render(
              <Menu.Root modal>
                <Menu.Trigger>Open</Menu.Trigger>
                <Menu.Portal keepMounted={keepMounted}>
                  <Menu.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                    <Menu.Popup>
                      <Menu.Item>1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);

            const menu = await screen.findByRole('menu');
            const doc = menu.ownerDocument;

            await waitFor(() => {
              expect(isScrollLocked(doc)).toBe(true);
            });
          },
        );

        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'should not apply scroll lock when a touch-opened popup $name is narrower than the viewport',
          async ({ keepMounted }) => {
            await render(
              <Menu.Root modal>
                <Menu.Trigger>Open</Menu.Trigger>
                <Menu.Portal keepMounted={keepMounted}>
                  <Menu.Positioner data-testid="positioner" style={{ width: '240px' }}>
                    <Menu.Popup>
                      <Menu.Item>1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);

            const menu = await screen.findByRole('menu');
            const doc = menu.ownerDocument;

            await waitSingleFrame();
            await flushMicrotasks();

            expect(isScrollLocked(doc)).toBe(false);
          },
        );
      });
    });
  });

  describe('in a menubar', () => {
    it('reads the id, the disabled state and the mouse-up ref of the menubar', async () => {
      const disabled = shallowRef(false);
      const allowMouseUpTriggerRef = shallowRef(false);
      const context = createMenubarContext({
        disabled: computed(() => disabled.value),
        allowMouseUpTriggerRef,
      });
      const probe = createProbe();
      await render(
        <MenubarProvider context={context}>
          <Menu.Root>
            <probe.Probe />
          </Menu.Root>
        </MenubarProvider>,
      );
      const { store } = probe;
      const storeDisabled = computed(() => store.select('disabled'));

      expect(store.state.parent.type).toBe('menubar');
      expect(store.select('rootId')).toBe('menubar');
      expect(store.select('modal')).toBe(false);
      expect(store.context.allowMouseUpTriggerRef).toBe(allowMouseUpTriggerRef);
      expect(storeDisabled.value).toBe(false);

      disabled.value = true;

      expect(storeDisabled.value).toBe(true);
    });
  });

  describe('in a context menu', () => {
    it('gives setOpen and the positioner to the context menu and takes them back at the unmount', async () => {
      const context = createContextMenuContext();
      const probe = createProbe();
      const { unmount } = await render(
        <ContextMenuProvider context={context}>
          <Menu.Root>
            <probe.Probe />
          </Menu.Root>
        </ContextMenuProvider>,
      );
      const { store } = probe;
      const positioner = document.createElement('div');

      expect(store.state.parent.type).toBe('context-menu');
      expect(store.select('rootId')).toBe('context-menu');
      expect(store.select('modal')).toBe(true);
      expect(context.actionsRef.value?.setOpen).toBe(store.setOpen);

      store.set('positionerElement', positioner);
      await flushMicrotasks();

      expect(context.positionerRef.value).toBe(positioner);

      unmount();

      expect(context.actionsRef.value).toBe(null);
      expect(context.positionerRef.value).toBe(null);
    });

    it('does not close for a press outside in the first 500 ms, unless a contextmenu event opened it', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root onOpenChange={(open) => events.push(open)}>
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
      );
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('contextmenu')),
      );
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true, false, true, false]);
    });

    it('gives each open of a context menu its own grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root onOpenChange={(open) => events.push(open)}>
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });
      const openWithMousedown = () =>
        store.setOpen(
          true,
          createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
        );

      openWithMousedown();
      await flushMicrotasks();
      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);

      openWithMousedown();
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true, false, true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false, true, false]);
    });

    it('gives a context menu that mounts open the grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root defaultOpen onOpenChange={(open) => events.push(open)}>
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      await pressOutside();

      expect(events).toEqual([]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([false]);
    });

    it('forgets the contextmenu event of the last open, so that the next open has the grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const open = shallowRef(false);
      const probe = createProbe();
      const { getByTestId } = await render(() => (
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen) => events.push(nextOpen)}
              onUpdate:open={(nextOpen) => {
                open.value = nextOpen;
              }}
            >
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>
      ));
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('contextmenu')),
      );
      await flushMicrotasks();

      expect(store.context.lastOpenChangeEvent?.type).toBe('contextmenu');

      open.value = false;
      await flushMicrotasks();

      expect(store.context.lastOpenChangeEvent).toBe(undefined);

      open.value = true;
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);
    });
  });

  it('VUE-5: keeps its open state under KeepAlive and hears no Escape while deactivated', async () => {
    const events: unknown[] = [];
    const visible = shallowRef(true);
    const probe = createProbe();
    const Branch = defineComponent({
      setup: () => () => (
        <Menu.Root
          defaultOpen
          onOpenChange={(open, details) => events.push([open, details.reason])}
        >
          <probe.Probe />
          <TestPopup />
        </Menu.Root>
      ),
    });
    const Other = defineComponent({ setup: () => () => <span /> });
    await render(() => (
      <KeepAlive>{visible.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
    ));

    visible.value = false;
    await flushMicrotasks();
    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(events).toEqual([]);
    expect(probe.store.state.open).toBe(true);

    visible.value = true;
    await flushMicrotasks();
    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(events).toEqual([[false, 'escape-key']]);
  });

  describe('server render', () => {
    it('renders the trigger of an open root as open, and a detached trigger with no open state', async () => {
      const serverHtml = await renderOnServer('src/menu/root/MenuRootHydration.test.vue', {});
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      const triggers = Array.from(template.content.querySelectorAll('button'));
      expect(triggers.map((trigger) => trigger.id)).toEqual(['in-root', 'detached']);
      expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
      expect(triggers[0].hasAttribute('data-popup-open')).toBe(true);
      expect(triggers[1].getAttribute('aria-haspopup')).toBe('menu');
      expect(triggers[1].hasAttribute('aria-expanded')).toBe(false);
      expect(triggers[1].hasAttribute('data-popup-open')).toBe(false);
      expect(template.content.querySelector('[role="menu"]')).toBe(null);
    });

    it('hydrates an open root, a trigger of a handle and their portals, with no message', async () => {
      const serverHtml = await renderOnServer('src/menu/root/MenuRootHydration.test.vue', {});

      await hydrate(MenuRootHydration, { serverHtml });
    });
  });
});
