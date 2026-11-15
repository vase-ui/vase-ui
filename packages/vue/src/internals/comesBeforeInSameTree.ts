/**
 * Whether `element` comes before `reference` in one tree. Nodes in two trees, such as two shadow
 * roots, have an order that depends on the browser. The function gives `false` for them, so the
 * caller keeps the order of its registry.
 */
export function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (
    (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}
