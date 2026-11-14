import { contains } from '../../common/shadowDom';
import { getNodeChildren } from '../../utils/popups/tree/nodes';
import type { FloatingTreeType } from '../../utils/popups/types';

interface Targets {
  currentTarget: HTMLElement | null;
  relatedTarget: HTMLElement | null;
}

interface Params {
  popupElement: HTMLElement | null;
  rootElement: HTMLElement | null;
  tree: FloatingTreeType | null;
  nodeId: string | undefined;
}

export function isOutsideMenuEvent({ currentTarget, relatedTarget }: Targets, params: Params) {
  const { popupElement, rootElement, tree, nodeId } = params;

  const nodeChildrenContains = tree
    ? getNodeChildren(tree.nodesRef.value, nodeId).some((node) =>
        contains(node.context?.elements.floating, relatedTarget),
      )
    : false;

  if (!popupElement) {
    return !contains(rootElement, relatedTarget) && !nodeChildrenContains;
  }

  return (
    !contains(popupElement, currentTarget) &&
    !contains(popupElement, relatedTarget) &&
    !contains(rootElement, relatedTarget) &&
    !nodeChildrenContains
  );
}
