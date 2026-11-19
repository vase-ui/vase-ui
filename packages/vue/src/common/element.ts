import { computed, shallowRef } from 'vue';

/**
 * The element that a part renders, from the function ref that the part binds to it. The part
 * renders it, or the developer renders it in the `element` slot and binds `elementRef`, because
 * Vapor ignores `ref` in `v-bind`. A component in the slot exposes its element as `element`,
 * because a Vapor component has no `$el`.
 */
export function useElement<T extends Element>() {
  const target = shallowRef<unknown>(null);
  const element = computed(() => {
    const value = target.value as Element | { element?: Element } | null;
    if (!value) return null;
    // An element of another window, such as server HTML that hydrates in an `<iframe>`, has the
    // classes of that window.
    return (isElement(value) ? value : (value.element ?? null)) as T | null;
  });
  function setElement(value: unknown) {
    target.value = value;
  }
  return { element, setElement };
}

function isElement(value: object): value is Element {
  return (value as Partial<Node>).nodeType === 1;
}

/** Compares two nodes by their order in the document, for `sort`. */
export function byDocumentOrder(a: Node, b: Node) {
  return a.compareDocumentPosition(b) & a.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
