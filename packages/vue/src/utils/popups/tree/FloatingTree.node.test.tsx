import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, shallowRef, Teleport } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from './FloatingTree';
import { FloatingTreeStore } from './FloatingTreeStore';

const sharedTree = new FloatingTreeStore();

const NodePart = defineComponent({
  props: { name: String },
  setup(props, { slots }) {
    const parentId = useFloatingParentNodeId();
    provideFloatingNode(useFloatingNodeId());
    return () => (
      <div data-name={props.name} data-nested={parentId.value !== null}>
        {slots.default?.()}
      </div>
    );
  },
});

const Page = defineComponent({
  setup() {
    provideFloatingTree(sharedTree);
    return () => (
      <NodePart name="parent">
        <NodePart name="child" />
        <Teleport to="body">
          <NodePart name="teleported" />
        </Teleport>
      </NodePart>
    );
  },
});

describe('FloatingTree on a server', () => {
  it('registers no node, so two renders share no state through a tree of a module', async () => {
    await renderToString(createSSRApp(Page));
    await renderToString(createSSRApp(Page));

    expect(sharedTree.nodesRef.value).toEqual([]);
  });

  it('gives the parent node id in the server HTML, also in a Teleport', async () => {
    const context: { teleports?: Record<string, string> } = {};
    const html = await renderToString(createSSRApp(Page), context);

    expect(html).toContain('<div data-name="parent" data-nested="false">');
    expect(html).toContain('<div data-name="child" data-nested="true">');
    expect(context.teleports?.body).toContain('<div data-name="teleported" data-nested="true">');
  });

  it('gives the tree of a getter to the parts below, and registers no node', async () => {
    const tree = new FloatingTreeStore();
    let treeBelow: unknown;
    const Below = defineComponent({
      setup() {
        treeBelow = useFloatingTree().value;
        useFloatingNodeId();
        return () => null;
      },
    });
    const Root = defineComponent({
      setup() {
        provideFloatingTree(() => tree);
        return () => <Below />;
      },
    });

    await renderToString(createSSRApp(Root));

    expect(treeBelow).toBe(tree);
    expect(tree.nodesRef.value).toEqual([]);
  });

  it('gives the same tree of its own after a reactive write', async () => {
    const written = shallowRef(0);
    const reads: FloatingTreeStore[] = [];
    const Root = defineComponent({
      setup() {
        const provided = provideFloatingTree();
        reads.push(provided.value);
        written.value += 1;
        reads.push(provided.value);
        return () => null;
      },
    });

    await renderToString(createSSRApp(Root));

    expect(reads[0]).toBeInstanceOf(FloatingTreeStore);
    expect(reads[1]).toBe(reads[0]);
  });
});
