/**
 * Tells if a value of a label has content to show. A function counts, because it returns the
 * content of the label.
 */
export function isRenderableNode(node: unknown): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}
