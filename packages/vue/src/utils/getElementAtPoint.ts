type ElementFromPointRoot = Node & Partial<Pick<Document, 'elementFromPoint'>>;

// `Document.elementFromPoint` gives the shadow host for the content of a shadow root. A
// `contains()` check against a popup in that shadow root then fails. Thus the callers give
// `getRootNode()`, which is a document or a shadow root, and not `ownerDocument()`.
export function getElementAtPoint(
  root: ElementFromPointRoot | null | undefined,
  x: number,
  y: number,
) {
  return typeof root?.elementFromPoint === 'function' ? root.elementFromPoint(x, y) : null;
}
