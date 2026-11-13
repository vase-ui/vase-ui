import { describe, expect, it, onTestFinished, test, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, nextTick, onMounted, shallowRef, watch } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import type { Placement, VirtualElement } from '@floating-ui/vue';
import { createRenderer, fireEvent, flushMicrotasks } from '#test-utils';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { useDismiss } from '../interactions/useDismiss';
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
  const onOpenChange = vi.fn();
  const store = new FloatingRootStore({
    open,
    anchorElement,
    positionerElement,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange,
  });
  return { store, anchorElement, positionerElement, onOpenChange };
}

/** Puts the elements of the store in the document, so that a press can reach them. */
function createDocumentStore() {
  const popup = createStore();
  document.body.append(popup.anchorElement, popup.positionerElement);
  onTestFinished(() => {
    popup.anchorElement.remove();
    popup.positionerElement.remove();
  });
  return popup;
}

function reasonsOf(onOpenChange: ReturnType<typeof vi.fn>) {
  return onOpenChange.mock.calls.map(
    (call) => (call[1] as VaseUIChangeEventDetails<string>).reason,
  );
}

const mouse = { pointerType: 'mouse' };

async function pressAndClick(target: Element) {
  await fireEvent.pointerDown(target, mouse);
  await fireEvent.mouseDown(target);
  await fireEvent.pointerUp(target, mouse);
  await fireEvent.mouseUp(target);
  await fireEvent.click(target, { detail: 1 });
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

/** A part that has a node in the tree and provides it, as a detached trigger does. */
function createNodeOwner(tree: FloatingTreeStore, onId: (id: string) => void) {
  return defineComponent({
    setup(_, { slots }) {
      const id = useFloatingNodeId(tree);
      onId(id);
      provideFloatingNode(id);
      return () => slots.default?.();
    },
  });
}

/** A popup that has a node in the tree, provides it to its content, and closes for a dismissal. */
function createParentPopup(tree: FloatingTreeStore, store: FloatingRootStore) {
  const { positioning } = createPositioning();
  return defineComponent({
    setup(_, { slots }) {
      const nodeId = useFloatingNodeId(tree);
      provideFloatingNode(nodeId);
      useVaseUIFloating({
        rootStore: store,
        mounted: true,
        positioning,
        nodeId,
        externalTree: tree,
      });
      useDismiss(store, { externalTree: tree });
      return () => slots.default?.();
    },
  });
}

interface Place {
  tree: FloatingTreeStore;
  nodeId: string | undefined;
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

  it('gives the dismissal the children of the new node when the provider changes its tree', async () => {
    const first = new FloatingTreeStore();
    const second = new FloatingTreeStore();
    const popup = createDocumentStore();
    const child = createDocumentStore();
    const { positioning } = createPositioning();
    const place = shallowRef<Place>({ tree: first, nodeId: undefined });
    const ids: Record<string, string> = {};
    const NodeInFirst = createNodeOwner(first, (id) => {
      ids.first = id;
    });
    const NodeInSecond = createNodeOwner(second, (id) => {
      ids.second = id;
    });
    // The popup reads the tree of the part above it, and the node of the place.
    const Popup = defineComponent({
      setup() {
        useVaseUIFloating({
          rootStore: popup.store,
          mounted: true,
          positioning,
          nodeId: () => place.value.nodeId,
        });
        useDismiss(popup.store);
        return () => null;
      },
    });
    const Child = defineComponent({
      setup() {
        const nodeId = useFloatingNodeId();
        useVaseUIFloating({ rootStore: child.store, mounted: true, positioning, nodeId });
        useDismiss(child.store);
        return () => null;
      },
    });
    const TreeOfPlace = defineComponent({
      setup(_, { slots }) {
        provideFloatingTree(() => place.value.tree);
        return () => slots.default?.();
      },
    });
    await render(
      <>
        <NodeInFirst />
        <TreeScope tree={second}>
          <NodeInSecond>
            <Child />
          </NodeInSecond>
        </TreeScope>
        <TreeOfPlace>
          <Popup />
        </TreeOfPlace>
      </>,
    );

    place.value = { tree: second, nodeId: ids.second };
    await flushMicrotasks();
    await pressAndClick(child.positionerElement);
    expect(reasonsOf(popup.onOpenChange)).toEqual([]);

    await fireEvent.pointerDown(document.body, mouse);
    expect(reasonsOf(popup.onOpenChange)).toEqual(['outside-press']);
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

  describe('VUE-43: the context of a popup that leaves a node', () => {
    it('moves to the new node when the tree and the node id change, and the old node loses it', async () => {
      const first = new FloatingTreeStore();
      const second = new FloatingTreeStore();
      const { store } = createStore();
      const { positioning } = createPositioning();
      const place = shallowRef<Place>({ tree: first, nodeId: undefined });
      const ids: Record<string, string> = {};
      const NodeInFirst = createNodeOwner(first, (id) => {
        ids.first = id;
      });
      const NodeInSecond = createNodeOwner(second, (id) => {
        ids.second = id;
      });
      let context!: PopupPositioningContext;
      const Positioner = createPositioner(
        {
          rootStore: store,
          mounted: true,
          positioning,
          nodeId: () => place.value.nodeId,
          externalTree: () => place.value.tree,
        },
        (value) => {
          context = value;
        },
      );
      await render(
        <>
          <NodeInFirst />
          <NodeInSecond />
          <Positioner />
        </>,
      );
      const contexts = () => [first, second].map((tree) => tree.nodesRef.value[0].context);
      expect(context.nodeId).toBeUndefined();
      expect(contexts()).toEqual([undefined, undefined]);

      place.value = { tree: first, nodeId: ids.first };
      expect(context.nodeId).toBe(ids.first);
      await nextTick();
      expect(contexts()).toEqual([context, undefined]);

      place.value = { tree: second, nodeId: ids.second };
      expect(context.nodeId).toBe(ids.second);
      expect({ ...context }.nodeId).toBe(ids.second);
      await nextTick();
      expect(contexts()).toEqual([undefined, context]);

      place.value = { tree: second, nodeId: undefined };
      await nextTick();
      expect(contexts()).toEqual([undefined, undefined]);
    });

    it('leaves the node of another part when the positioner unmounts', async () => {
      const tree = new FloatingTreeStore();
      const { store } = createStore();
      const { positioning } = createPositioning();
      let ownerId = '';
      const Owner = createNodeOwner(tree, (id) => {
        ownerId = id;
      });
      let context!: PopupPositioningContext;
      const Positioner = createPositioner(
        { rootStore: store, mounted: true, positioning, nodeId: () => ownerId, externalTree: tree },
        (value) => {
          context = value;
        },
      );
      const show = shallowRef(true);
      await render(() => (
        <>
          <Owner />
          {show.value && <Positioner />}
        </>
      ));
      expect(tree.nodesRef.value[0].context).toBe(context);

      show.value = false;
      await nextTick();

      expect(tree.nodesRef.value[0].context).toBeUndefined();
    });

    it('stays on the node for a newer positioner when an older positioner unmounts', async () => {
      const tree = new FloatingTreeStore();
      const { store } = createStore();
      const { positioning } = createPositioning();
      let ownerId = '';
      const Owner = createNodeOwner(tree, (id) => {
        ownerId = id;
      });
      const options = {
        rootStore: store,
        mounted: true,
        positioning,
        nodeId: () => ownerId,
        externalTree: tree,
      };
      let newer!: PopupPositioningContext;
      const Older = createPositioner(options);
      const Newer = createPositioner(options, (value) => {
        newer = value;
      });
      const older = shallowRef(true);
      await render(() => (
        <>
          <Owner />
          {older.value && <Older />}
          <Newer />
        </>
      ));
      expect(tree.nodesRef.value[0].context).toBe(newer);

      older.value = false;
      await nextTick();

      expect(tree.nodesRef.value[0].context).toBe(newer);
    });

    it('leaves the node of an active part while KeepAlive holds the positioner, and comes back to the node of that time', async () => {
      const first = new FloatingTreeStore();
      const second = new FloatingTreeStore();
      const { store } = createStore();
      const { positioning } = createPositioning();
      const place = shallowRef<Place>({ tree: first, nodeId: undefined });
      const ids: Record<string, string> = {};
      const NodeInFirst = createNodeOwner(first, (id) => {
        ids.first = id;
      });
      const NodeInSecond = createNodeOwner(second, (id) => {
        ids.second = id;
      });
      let context!: PopupPositioningContext;
      const Positioner = createPositioner(
        {
          rootStore: store,
          mounted: true,
          positioning,
          nodeId: () => place.value.nodeId,
          externalTree: () => place.value.tree,
        },
        (value) => {
          context = value;
        },
      );
      const visible = shallowRef(true);
      await render(() => (
        <>
          <NodeInFirst />
          <NodeInSecond />
          <KeepAlive>{visible.value ? <Positioner key="popup" /> : <span key="other" />}</KeepAlive>
        </>
      ));
      const contexts = () => [first, second].map((tree) => tree.nodesRef.value[0].context);
      place.value = { tree: first, nodeId: ids.first };
      await nextTick();
      expect(contexts()).toEqual([context, undefined]);

      visible.value = false;
      await nextTick();
      expect(contexts()).toEqual([undefined, undefined]);

      place.value = { tree: second, nodeId: ids.second };
      await nextTick();
      expect(contexts()).toEqual([undefined, undefined]);

      visible.value = true;
      await nextTick();
      expect(contexts()).toEqual([undefined, context]);
    });

    it('lets the popup above the old node close for a press in the popup', async () => {
      const tree = new FloatingTreeStore();
      const parent = createDocumentStore();
      const moved = createDocumentStore();
      const { positioning } = createPositioning();
      const nodeId = shallowRef<string | undefined>();
      const ids: Record<string, string> = {};
      const Inside = createNodeOwner(tree, (id) => {
        ids.inside = id;
      });
      const Outside = createNodeOwner(tree, (id) => {
        ids.outside = id;
      });
      const Parent = createParentPopup(tree, parent.store);
      // This popup is not below the parent popup. It uses the node of a part that is.
      const Moved = defineComponent({
        setup() {
          useVaseUIFloating({
            rootStore: moved.store,
            mounted: true,
            positioning,
            nodeId,
            externalTree: tree,
          });
          useDismiss(moved.store, { externalTree: tree });
          return () => null;
        },
      });
      await render(
        <>
          <Parent>
            <Inside />
          </Parent>
          <Outside />
          <Moved />
        </>,
      );

      nodeId.value = ids.inside;
      await flushMicrotasks();
      await pressAndClick(moved.positionerElement);
      expect(reasonsOf(parent.onOpenChange)).toEqual([]);

      nodeId.value = ids.outside;
      await flushMicrotasks();
      await fireEvent.pointerDown(moved.positionerElement, mouse);
      expect(reasonsOf(parent.onOpenChange)).toEqual(['outside-press']);
    });

    it('lets the popup above close for Escape after the popup unmounts while open', async () => {
      const tree = new FloatingTreeStore();
      const parent = createDocumentStore();
      const child = createDocumentStore();
      const { positioning } = createPositioning();
      let insideId = '';
      const Inside = createNodeOwner(tree, (id) => {
        insideId = id;
      });
      const Parent = createParentPopup(tree, parent.store);
      const Child = defineComponent({
        setup() {
          useVaseUIFloating({
            rootStore: child.store,
            mounted: true,
            positioning,
            nodeId: () => insideId,
            externalTree: tree,
          });
          useDismiss(child.store, { externalTree: tree });
          return () => null;
        },
      });
      const show = shallowRef(true);
      await render(() => (
        <>
          <Parent>
            <Inside />
          </Parent>
          {show.value && <Child />}
        </>
      ));

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(child.onOpenChange).toHaveBeenCalledTimes(1);
      expect(reasonsOf(parent.onOpenChange)).toEqual([]);

      show.value = false;
      await flushMicrotasks();
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(reasonsOf(parent.onOpenChange)).toEqual(['escape-key']);
    });
  });
});
