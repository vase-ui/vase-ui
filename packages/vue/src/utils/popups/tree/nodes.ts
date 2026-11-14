import type { FloatingNodeType } from '../types';

export function getNodeChildren(
  nodes: FloatingNodeType[],
  id: string | undefined,
  onlyOpenChildren = true,
): FloatingNodeType[] {
  const directChildren = nodes.filter((node) => node.parentId === id);

  return directChildren.flatMap((child) => [
    ...(!onlyOpenChildren || child.context?.open ? [child] : []),
    ...getNodeChildren(nodes, child.id, onlyOpenChildren),
  ]);
}

export function getNodeAncestors(nodes: FloatingNodeType[], id: string | undefined) {
  let allAncestors: FloatingNodeType[] = [];
  let currentParentId = nodes.find((node) => node.id === id)?.parentId;

  while (currentParentId) {
    const currentNode = nodes.find((node) => node.id === currentParentId);
    currentParentId = currentNode?.parentId;

    if (currentNode) {
      allAncestors = allAncestors.concat(currentNode);
    }
  }

  return allAncestors;
}
