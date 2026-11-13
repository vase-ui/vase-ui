import { describe, expect, it, test, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, onMounted, shallowRef, watch } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import type { Placement, VirtualElement } from '@floating-ui/vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../tree/FloatingTree';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getNodeChildren } from '../tree/nodes';
import type { PopupPositioningContext, ReferenceType } from '../types';
import { useVaseUIFloating } from './useFloating';
import type { UseFloatingOptions } from './useFloating';

const { render } = createRenderer();

function createStore(open = true) {
  const anchorElement = document.createElement('button');
  const positionerElement = document.createElement('div');
  const store = new FloatingRootStore({
    open,
    anchorElement,
    positionerElement,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: vi.fn(),
  });
  return { store, anchorElement, positionerElement };
}

function createPositioning(referenceElement: ReferenceType | null = null) {
  const reference = shallowRef<ReferenceType | null>(referenceElement);
  const placement = shallowRef<Placement>('bottom');
  return {
    reference,
    placement,
    positioning: { reference: computed(() => reference.value), placement },
  };
}

/** Calls the composable in `setup`, as a positioner does, and gives the context to `onContext`. */
function createPositioner(
  options: UseFloatingOptions,
  onContext: (context: PopupPositioningContext) => void = () => {},
) {
  return defineComponent({
    setup(_, { slots }) {
      onContext(useVaseUIFloating(options));
      return () => slots.default?.();
    },
  });
}

/** A positioner that is a node of the tree of its parent, as a positioner of a family is. */
function createNodePositioner(
  options: Omit<UseFloatingOptions, 'nodeId'>,
  onContext: (context: PopupPositioningContext) => void = () => {},
) {
  return defineComponent({
    setup(_, { slots }) {
      const nodeId = useFloatingNodeId();
      provideFloatingNode(nodeId);
      onContext(useVaseUIFloating({ ...options, nodeId }));
      return () => slots.default?.();
    },
  });
}

const TreeScope = defineComponent({
  props: { tree: { type: Object as PropType<FloatingTreeStore>, required: true } },
  setup(props, { slots }) {
    provideFloatingTree(props.tree);
    return () => slots.default?.();
  },
});

test('uses the supplied root store while preserving DOM and position references', async () => {
  const { store, anchorElement, positionerElement } = createStore();
  const { reference, positioning } = createPositioning(anchorElement);
  let context!: PopupPositioningContext;
  const Positioner = createPositioner({ rootStore: store, mounted: true, positioning }, (value) => {
    context = value;
  });

  await render(<Positioner />);
  await flushMicrotasks();

  expect(context.rootStore).toBe(store);
  expect(store.context.positioning).toBe(context);
  expect(context.elements.floating).toBe(positionerElement);
  expect(context.elements.domReference).toBe(anchorElement);

  const anchorOverride: VirtualElement = {
    getBoundingClientRect: () => new DOMRect(1, 2, 3, 4),
  };
  reference.value = anchorOverride;

  expect(context.elements.reference).toBe(anchorOverride);
  expect(store.state.anchorElement).toBe(anchorElement);
  expect(context.elements.domReference).toBe(anchorElement);
});

describe('useVaseUIFloating', () => {
  it('gives the current value on each read', async () => {
    const { store, positionerElement } = createStore();
    const { placement, reference, positioning } = createPositioning();
    let context!: PopupPositioningContext;
    const Positioner = createPositioner(
      { rootStore: store, mounted: true, positioning },
      (value) => {
        context = value;
      },
    );
    await render(<Positioner />);
    expect(context).toMatchObject({ open: true, placement: 'bottom' });

    const otherPositioner = document.createElement('div');
    const other = document.createElement('span');
    store.update({ positionerElement: otherPositioner });
    placement.value = 'top-start';
    reference.value = other;

    expect(context.placement).toBe('top-start');
    expect(context.elements.floating).toBe(otherPositioner);
    expect(context.elements.floating).not.toBe(positionerElement);
    expect(context.elements.reference).toBe(other);
  });

  it('gives the open state of the last DOM update', async () => {
    const { store } = createStore();
    const { positioning } = createPositioning();
    const seenBeforeUpdate: boolean[] = [];
    let context!: PopupPositioningContext;
    const Positioner = createPositioner(
      { rootStore: store, mounted: true, positioning },
      (value) => {
        context = value;
        // A watcher with the default flush runs before the DOM update.
        watch(
          () => store.select('open'),
          () => {
            seenBeforeUpdate.push(context.open);
          },
        );
      },
    );
    await render(<Positioner />);
    expect(context.open).toBe(true);

    // The popup above reads the context in the event in which this popup closes.
    store.update({ open: false });
    expect(context.open).toBe(true);

    await flushMicrotasks();
    expect(seenBeforeUpdate).toEqual([true]);
    expect(context.open).toBe(false);
  });

  it('gives the context to the store and to its node before the parts below are mounted', async () => {
    const tree = new FloatingTreeStore();
    const { store } = createStore();
    const { positioning } = createPositioning();
    const seen: Record<string, PopupPositioningContext | undefined> = {};
    const Below = defineComponent({
      setup() {
        const contextTree = useFloatingTree();
        const parentId = useFloatingParentNodeId();
        const findNode = () =>
          contextTree.value?.nodesRef.value.find((node) => node.id === parentId.value);
        seen.storeInSetup = store.context.positioning;
        seen.nodeInSetup = findNode()?.context;
        onMounted(() => {
          seen.storeInMounted = store.context.positioning;
        });
        return () => null;
      },
    });
    let context!: PopupPositioningContext;
    const Positioner = createNodePositioner(
      { rootStore: store, mounted: true, positioning },
      (value) => {
        context = value;
      },
    );

    await render(
      <TreeScope tree={tree}>
        <Positioner>
          <Below />
        </Positioner>
      </TreeScope>,
    );

    expect(seen).toEqual({
      storeInSetup: context,
      nodeInSetup: context,
      storeInMounted: context,
    });
  });

  it('gives the context to a node that registers after the positioner mounts', async () => {
    const tree = new FloatingTreeStore();
    const externalTree = shallowRef<FloatingTreeStore | undefined>(undefined);
    const { store } = createStore();
    const { positioning } = createPositioning();
    let context!: PopupPositioningContext;
    const Positioner = defineComponent({
      setup() {
        const nodeId = useFloatingNodeId(externalTree);
        context = useVaseUIFloating({
          rootStore: store,
          mounted: true,
          positioning,
          nodeId,
          externalTree,
        });
        return () => null;
      },
    });
    await render(<Positioner />);
    expect(tree.nodesRef.value).toEqual([]);

    externalTree.value = tree;
    await flushMicrotasks();

    expect(tree.nodesRef.value.map((node) => node.context)).toEqual([context]);
  });

  it('removes the context from the store when the part unmounts', async () => {
    const { store } = createStore();
    const { positioning } = createPositioning();
    const Positioner = createPositioner({ rootStore: store, mounted: true, positioning });
    const { unmount } = await render(<Positioner />);
    expect(store.context.positioning).toBeDefined();

    unmount();

    expect(store.context.positioning).toBeUndefined();
  });

  it('keeps the context of a newer positioner when an older positioner unmounts', async () => {
    const { store } = createStore();
    const { positioning } = createPositioning();
    const older = shallowRef(true);
    let newer!: PopupPositioningContext;
    const Older = createPositioner({ rootStore: store, mounted: true, positioning });
    const Newer = createPositioner({ rootStore: store, mounted: true, positioning }, (value) => {
      newer = value;
    });
    await render(() => (
      <>
        {older.value && <Older />}
        <Newer />
      </>
    ));
    expect(store.context.positioning).toBe(newer);

    older.value = false;
    await flushMicrotasks();

    expect(store.context.positioning).toBe(newer);
  });

  it('moves the context to a new root store', async () => {
    const first = createStore().store;
    const second = createStore().store;
    const rootStore = shallowRef(first);
    const { positioning } = createPositioning();
    let context!: PopupPositioningContext;
    const Positioner = createPositioner({ rootStore, mounted: true, positioning }, (value) => {
      context = value;
    });
    await render(<Positioner />);
    expect(first.context.positioning).toBe(context);

    rootStore.value = second;
    await flushMicrotasks();

    expect(first.context.positioning).toBeUndefined();
    expect(second.context.positioning).toBe(context);
    expect(context.rootStore).toBe(second);
  });

  it('hides the context of a deactivated popup from the store and from the tree', async () => {
    const tree = new FloatingTreeStore();
    const { store } = createStore();
    const { positioning } = createPositioning();
    const visible = shallowRef(true);
    let context!: PopupPositioningContext;
    const Positioner = createNodePositioner(
      { rootStore: store, mounted: true, positioning },
      (value) => {
        context = value;
      },
    );
    let parentId: string | undefined;
    const Parent = defineComponent({
      setup(_, { slots }) {
        parentId = useFloatingNodeId();
        provideFloatingNode(parentId);
        return () => slots.default?.();
      },
    });
    const openChildren = () => getNodeChildren(tree.nodesRef.value, parentId).length;

    await render(() => (
      <TreeScope tree={tree}>
        <Parent>
          <KeepAlive>{visible.value ? <Positioner key="popup" /> : <span key="other" />}</KeepAlive>
        </Parent>
      </TreeScope>
    ));
    expect(store.context.positioning).toBe(context);
    expect(openChildren()).toBe(1);

    visible.value = false;
    await flushMicrotasks();
    expect(store.context.positioning).toBeUndefined();
    expect(openChildren()).toBe(0);

    visible.value = true;
    await flushMicrotasks();
    expect(store.context.positioning).toBe(context);
    expect(openChildren()).toBe(1);
  });

  it('forgets the anchor and the elements of the store while the popup is not mounted', async () => {
    const { store, anchorElement, positionerElement } = createStore();
    const { positioning } = createPositioning();
    const mounted: ShallowRef<boolean> = shallowRef(false);
    const Positioner = createPositioner({ rootStore: store, mounted, positioning });

    await render(<Positioner />);
    expect(store.state).toMatchObject({ anchorElement: null, positionerElement: null });

    store.update({ anchorElement, positionerElement });
    mounted.value = true;
    await flushMicrotasks();
    expect(store.state).toMatchObject({ anchorElement, positionerElement });

    mounted.value = false;
    await flushMicrotasks();
    expect(store.state).toMatchObject({ anchorElement: null, positionerElement: null });
  });
});
