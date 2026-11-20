import { computed, shallowRef, useSlots } from 'vue';
import type { Component } from 'vue';

/**
 * The props of a part that renders a tag or a component in place of its own element. The props
 * type of the part omits `as` from the attributes of its element, because motion-v adds an `as`
 * to `HTMLAttributes` of Vue.
 */
export interface AsProps {
  /**
   * A tag or a component that the part renders in place of its own element, with the same
   * attributes and content. The `element` slot wins over it.
   */
  as?: keyof HTMLElementTagNameMap | Component;
}

/**
 * The tag in `as` of the part, known at the render, so that the server writes the attributes of that
 * element. The element of a component in `as`, or of the `element` slot, which wins over `as`, is
 * known after the mount.
 */
export function useAsTag(as: () => unknown): () => string | undefined {
  const slots = useSlots();
  return () => {
    const given = as();
    return typeof given === 'string' && !slots.element ? given : undefined;
  };
}

/**
 * The element that a part renders, from the function ref that the part binds to it. The part
 * renders it, or the developer renders it in the `element` slot and binds `elementRef`, because
 * Vapor ignores `ref` in `v-bind`. A component in the slot or in `as` gives its element as an
 * exposed `element`, else as its root element `$el`, which a Vapor component does not have.
 */
export function useElement<T extends Element>() {
  const target = shallowRef<unknown>(null);
  const element = computed(() => {
    const value = target.value as Element | { element?: unknown; $el?: unknown } | null;
    if (!value || isElement(value)) return value as T | null;
    // A component that exposes `element` gives it, also while it is `null`: its root element can
    // be a wrapper.
    const given = 'element' in value ? value.element : value.$el;
    return (isElement(given) ? given : null) as T | null;
  });
  function setElement(value: unknown) {
    target.value = value;
  }
  return { element, setElement };
}

// An element of another window, such as server HTML that hydrates in an `<iframe>`, has the
// classes of that window.
function isElement(value: unknown): value is Element {
  return value != null && (value as Partial<Node>).nodeType === 1;
}

/** Compares two nodes by their order in the document, for `sort`. */
export function byDocumentOrder(a: Node, b: Node) {
  return a.compareDocumentPosition(b) & a.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
