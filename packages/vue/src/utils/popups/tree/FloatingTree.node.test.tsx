import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, Teleport } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
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
});
