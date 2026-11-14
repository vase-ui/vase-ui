export { getWindow as ownerWindow } from '@floating-ui/utils/dom';

export function ownerDocument(node: Element | null) {
  // eslint-disable-next-line no-restricted-globals -- This helper gives the global document when there is no node. All other code gets the document from this helper.
  return node?.ownerDocument ?? document;
}
