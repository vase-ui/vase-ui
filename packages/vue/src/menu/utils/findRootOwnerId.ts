import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';

export function findRootOwnerId(node: Node): string | undefined {
  const rootOwnerId = isHTMLElement(node) ? node.getAttribute('data-rootownerid') : null;
  if (rootOwnerId !== null) {
    return rootOwnerId;
  }

  if (isLastTraversableNode(node)) {
    return undefined;
  }

  return findRootOwnerId(getParentNode(node));
}
