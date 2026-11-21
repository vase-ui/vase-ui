import { cdp } from 'vitest/browser';

/** A node of the accessibility tree of Chromium, with the fields that the measurements read. */
export type AXNode = {
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  value?: { value: unknown };
  properties?: { name: string; value: { value: unknown } }[];
};

type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };

/**
 * The nodes of the accessibility tree of Chromium, in each frame. The test page is in a frame.
 * Playwright reads the accessibility tree of Chromium only.
 */
export async function chromiumNodes() {
  const session = cdp();
  await session.send('Accessibility.enable');
  const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: FrameTree };
  const all: AXNode[] = [];
  const visit = async (tree: FrameTree) => {
    const { nodes } = (await session.send('Accessibility.getFullAXTree', {
      frameId: tree.frame.id,
    })) as { nodes: AXNode[] };
    all.push(...nodes);
    for (const child of tree.childFrames ?? []) await visit(child);
  };
  await visit(frameTree);
  return all;
}

/** The first node with this name in the accessibility tree of Chromium. */
export const byName = (nodes: AXNode[], name: string) =>
  nodes.find((node) => node.name?.value === name);

/** The value of a property of a node, such as `checked` or `orientation`. */
export const propertyOf = (node: AXNode | undefined, name: string) =>
  node?.properties?.find((property) => property.name === name)?.value.value;
