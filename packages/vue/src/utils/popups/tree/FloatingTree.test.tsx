import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef, Teleport } from 'vue';
import type { ComputedRef, PropType, ShallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import type { FloatingNodeType, FloatingTreeType, PopupPositioningContext } from '../types';
import {
  provideFloatingNode,
  provideFloatingTree,
  removeNodeContext,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from './FloatingTree';
import { FloatingTreeStore } from './FloatingTreeStore';
import { getNodeChildren } from './nodes';

const OPEN_CONTEXT = { open: true } as PopupPositioningContext;

const ids: Record<string, string> = {};

function nameOf(id: string | undefined) {
  return Object.keys(ids).find((name) => ids[name] === id);
}

function namesOf(nodes: FloatingNodeType[]) {
  return nodes.map((node) => nameOf(node.id));
}

function parentsOf(tree: FloatingTreeStore) {
  return Object.fromEntries(
    tree.nodesRef.value.map((node) => [
      nameOf(node.id),
      node.parentId === null ? null : nameOf(node.parentId),
    ]),
  );
}

const TreeScope = defineComponent({
  props: { tree: { type: Object as PropType<FloatingTreeStore>, required: true } },
  setup(props, { slots }) {
    provideFloatingTree(props.tree);
    return () => slots.default?.();
  },
});

/** A part that registers a node and provides it to its content, as a positioner does. */
const NodePart = defineComponent({
  props: { name: { type: String, required: true } },
  setup(props, { slots }) {
    const tree = useFloatingTree();
    const id = useFloatingNodeId();
    provideFloatingNode(id);
    ids[props.name] = id;
    onMounted(() => {
      const node = tree.value?.nodesRef.value.find((item) => item.id === id);
      if (node) {
        node.context = OPEN_CONTEXT;
      }
    });
    return () => <div data-testid={props.name}>{slots.default?.()}</div>;
  },
});

describe('FloatingTree', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    for (const name of Object.keys(ids)) {
      delete ids[name];
    }
  });

  it('gives a node in a Teleport the node of the part around it as its parent', async () => {
    const tree = new FloatingTreeStore();
    const { getByTestId } = await render(
      <TreeScope tree={tree}>
        <NodePart name="parent">
          <Teleport to="body">
            <NodePart name="child">
              <Teleport to="body">
                <NodePart name="grandchild" />
              </Teleport>
            </NodePart>
          </Teleport>
        </NodePart>
      </TreeScope>,
    );

    expect(getByTestId('parent')).not.toContainElement(getByTestId('child'));
    expect(parentsOf(tree)).toEqual({ parent: null, child: 'parent', grandchild: 'child' });
    expect(namesOf(getNodeChildren(tree.nodesRef.value, ids.parent))).toEqual([
      'child',
      'grandchild',
    ]);
  });

  it('registers a node before the parts below it are mounted', async () => {
    const tree = new FloatingTreeStore();
    let nodeOfRootAtMount: FloatingNodeType | undefined;
    const Below = defineComponent({
      setup() {
        const contextTree = useFloatingTree();
        const parentId = useFloatingParentNodeId();
        onMounted(() => {
          nodeOfRootAtMount = contextTree.value?.nodesRef.value.find(
            (node) => node.id === parentId.value,
          );
        });
        return () => null;
      },
    });

    await render(
      <TreeScope tree={tree}>
        <NodePart name="first" />
        <NodePart name="root">
          <NodePart name="inner" />
          <Below />
        </NodePart>
        <NodePart name="last" />
      </TreeScope>,
    );

    expect(nodeOfRootAtMount?.id).toBe(ids.root);
    expect(namesOf(tree.nodesRef.value)).toEqual(['first', 'root', 'inner', 'last']);
  });

  it('removes the node when its part is unmounted', async () => {
    const tree = new FloatingTreeStore();
    const show = shallowRef(true);
    await render(() => (
      <TreeScope tree={tree}>
        <NodePart name="kept" />
        {show.value ? (
          <NodePart name="parent">
            <Teleport to="body">
              <NodePart name="child" />
            </Teleport>
          </NodePart>
        ) : null}
      </TreeScope>
    ));
    expect(namesOf(tree.nodesRef.value)).toEqual(['kept', 'parent', 'child']);

    show.value = false;
    await nextTick();

    expect(namesOf(tree.nodesRef.value)).toEqual(['kept']);
  });

  it('keeps the place of a node that KeepAlive deactivates, and hides its context', async () => {
    const tree = new FloatingTreeStore();
    const Branch = defineComponent({
      name: 'Branch',
      setup: () => () => (
        <div>
          <NodePart name="before" />
          <NodePart name="parent">
            <Teleport to="body">
              <NodePart name="child" />
            </Teleport>
          </NodePart>
          <NodePart name="after" />
        </div>
      ),
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
    const showBranch = shallowRef(true);
    await render(() => (
      <TreeScope tree={tree}>
        <NodePart name="top">
          <KeepAlive>
            {showBranch.value ? <Branch key="branch" /> : <Other key="other" />}
          </KeepAlive>
        </NodePart>
      </TreeScope>
    ));
    const order = ['top', 'before', 'parent', 'child', 'after'];
    const openNodesBelowTop = () => namesOf(getNodeChildren(tree.nodesRef.value, ids.top));
    expect(namesOf(tree.nodesRef.value)).toEqual(order);
    expect(openNodesBelowTop()).toEqual(['before', 'parent', 'child', 'after']);

    showBranch.value = false;
    await nextTick();

    expect(namesOf(tree.nodesRef.value)).toEqual(order);
    expect(openNodesBelowTop()).toEqual([]);

    showBranch.value = true;
    await nextTick();

    expect(namesOf(tree.nodesRef.value)).toEqual(order);
    expect(openNodesBelowTop()).toEqual(['before', 'parent', 'child', 'after']);
  });

  it('removes a context from a node only when the node holds it, also while its part is deactivated', async () => {
    const tree = new FloatingTreeStore();
    const another = { open: true } as PopupPositioningContext;
    const plain: FloatingNodeType = { id: 'plain', parentId: null, context: OPEN_CONTEXT };
    const showPart = shallowRef(true);
    await render(() => (
      <TreeScope tree={tree}>
        <KeepAlive>
          {showPart.value ? <NodePart key="part" name="part" /> : <span key="other" />}
        </KeepAlive>
      </TreeScope>
    ));
    const [kept] = tree.nodesRef.value;
    expect(kept.context).toBe(OPEN_CONTEXT);

    showPart.value = false;
    await nextTick();
    removeNodeContext(kept, another);
    removeNodeContext(plain, another);
    showPart.value = true;
    await nextTick();
    expect([kept.context, plain.context]).toEqual([OPEN_CONTEXT, OPEN_CONTEXT]);

    showPart.value = false;
    await nextTick();
    removeNodeContext(kept, OPEN_CONTEXT);
    removeNodeContext(plain, OPEN_CONTEXT);
    showPart.value = true;
    await nextTick();
    expect([kept.context, plain.context]).toEqual([undefined, undefined]);
  });

  it('gives a node the parent id that the part above provides at the time of the read', async () => {
    const tree = new FloatingTreeStore();
    const providedId = shallowRef<string | undefined>('first');
    let parentId!: ComputedRef<string | null>;
    const Provider = defineComponent({
      setup(_, { slots }) {
        provideFloatingNode(providedId);
        return () => slots.default?.();
      },
    });
    const Reader = defineComponent({
      setup() {
        parentId = useFloatingParentNodeId();
        useFloatingNodeId();
        return () => null;
      },
    });
    await render(
      <TreeScope tree={tree}>
        <Provider>
          <Reader />
        </Provider>
      </TreeScope>,
    );
    const [node] = tree.nodesRef.value;
    expect([parentId.value, node.parentId]).toEqual(['first', 'first']);

    providedId.value = 'second';
    expect([parentId.value, node.parentId]).toEqual(['second', 'second']);

    providedId.value = undefined;
    expect([parentId.value, node.parentId]).toEqual([null, null]);
    expect(tree.nodesRef.value).toEqual([node]);
  });

  it('moves the node when the part gets another tree', async () => {
    const first = new FloatingTreeStore();
    const second = new FloatingTreeStore();
    const externalTree: ShallowRef<FloatingTreeStore | undefined> = shallowRef(first);
    const contextTree = new FloatingTreeStore();
    const Part = defineComponent({
      setup() {
        useFloatingNodeId(externalTree);
        return () => null;
      },
    });
    await render(
      <TreeScope tree={contextTree}>
        <Part />
      </TreeScope>,
    );
    const [node] = first.nodesRef.value;
    node.context = OPEN_CONTEXT;
    expect(contextTree.nodesRef.value).toEqual([]);

    externalTree.value = second;
    await nextTick();

    expect(first.nodesRef.value).toEqual([]);
    expect(second.nodesRef.value).toEqual([node]);
    expect(node.context).toBe(OPEN_CONTEXT);

    externalTree.value = undefined;
    await nextTick();

    expect(second.nodesRef.value).toEqual([]);
    expect(contextTree.nodesRef.value).toEqual([node]);
  });

  it('gives the parts below the new tree when the tree of the provider changes, and moves their nodes', async () => {
    const first = new FloatingTreeStore();
    const second = new FloatingTreeStore();
    const current = shallowRef(first);
    let treeBelow!: ComputedRef<FloatingTreeType | null>;
    const Provider = defineComponent({
      setup(_, { slots }) {
        provideFloatingTree(() => current.value);
        return () => slots.default?.();
      },
    });
    const Reader = defineComponent({
      setup() {
        treeBelow = useFloatingTree();
        return () => null;
      },
    });
    await render(
      <Provider>
        <NodePart name="outer">
          <NodePart name="inner" />
          <Reader />
        </NodePart>
      </Provider>,
    );
    expect(treeBelow.value).toBe(first);
    expect(namesOf(first.nodesRef.value)).toEqual(['outer', 'inner']);

    current.value = second;

    // A read is current at once. The nodes move in the flush.
    expect(treeBelow.value).toBe(second);
    expect(namesOf(first.nodesRef.value)).toEqual(['outer', 'inner']);

    await nextTick();

    expect(first.nodesRef.value).toEqual([]);
    expect(namesOf(second.nodesRef.value)).toEqual(['outer', 'inner']);
    expect(second.nodesRef.value.map((node) => node.context)).toEqual([OPEN_CONTEXT, OPEN_CONTEXT]);
    expect(parentsOf(second)).toEqual({ outer: null, inner: 'outer' });
  });

  it('provides one tree of its own when its source gives no tree', async () => {
    const external = new FloatingTreeStore();
    const source = shallowRef<FloatingTreeStore | undefined>(undefined);
    let provided!: ComputedRef<FloatingTreeStore>;
    const Provider = defineComponent({
      setup() {
        provided = provideFloatingTree(source);
        return () => null;
      },
    });
    await render(<Provider />);
    const own = provided.value;
    expect(own).toBeInstanceOf(FloatingTreeStore);

    source.value = external;
    expect(provided.value).toBe(external);

    source.value = undefined;
    expect(provided.value).toBe(own);
  });

  it('returns the tree that it provides, and a part does not get its own tree or node', async () => {
    const outerTree = new FloatingTreeStore();
    const externalTree = new FloatingTreeStore();
    const seen: Record<string, unknown> = {};
    const Root = defineComponent({
      props: { tree: Object as PropType<FloatingTreeStore> },
      setup(props, { slots }) {
        seen.provided = provideFloatingTree(props.tree).value;
        seen.treeOfRoot = useFloatingTree().value;
        provideFloatingNode('root');
        seen.parentOfRoot = useFloatingParentNodeId().value;
        return () => slots.default?.();
      },
    });
    const Below = defineComponent({
      setup() {
        seen.treeBelow = useFloatingTree().value;
        seen.parentBelow = useFloatingParentNodeId().value;
        return () => null;
      },
    });
    const view = await render(
      <TreeScope tree={outerTree}>
        <Root>
          <Below />
        </Root>
      </TreeScope>,
    );

    expect(seen.provided).not.toBe(outerTree);
    expect(seen.treeBelow).toBe(seen.provided);
    expect(seen.treeOfRoot).toBe(outerTree);
    expect(seen.parentOfRoot).toBe(null);
    expect(seen.parentBelow).toBe('root');

    view.unmount();
    await render(
      <Root tree={externalTree}>
        <Below />
      </Root>,
    );

    expect(seen.provided).toBe(externalTree);
    expect(seen.treeBelow).toBe(externalTree);
    expect(seen.treeOfRoot).toBe(null);
  });

  it('gives an id, no tree and no parent id when no tree and no node are above the part', async () => {
    const seen: Record<string, unknown> = {};
    const Part = defineComponent({
      setup() {
        seen.id = useFloatingNodeId();
        seen.tree = useFloatingTree().value;
        seen.parentId = useFloatingParentNodeId().value;
        return () => null;
      },
    });

    const { unmount } = await render(<Part />);
    unmount();

    expect(seen.id).toBeTypeOf('string');
    expect(seen.tree).toBe(null);
    expect(seen.parentId).toBe(null);
  });
});
