import { isVaporParts } from './testApp';

/**
 * Returns the element unchanged for virtual DOM parts. For Vapor parts, returns a deep clone
 * without comments or empty text nodes. Vapor uses these nodes as anchors for its DOM updates.
 * The clone keeps each element, attribute and nonempty text node, which includes white space.
 */
export function withoutVaporAnchors<T extends Element>(element: T): T {
  if (!isVaporParts) {
    return element;
  }
  const clone = element.cloneNode(true) as T;
  const walker = element.ownerDocument.createTreeWalker(
    clone,
    NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT,
  );
  const anchors: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.COMMENT_NODE || node.textContent === '') {
      anchors.push(node);
    }
  }
  for (const anchor of anchors) {
    anchor.parentNode?.removeChild(anchor);
  }
  return clone;
}
