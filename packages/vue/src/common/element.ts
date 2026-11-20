import { computed, shallowRef, useSlots } from 'vue';
import type { Component } from 'vue';

/**
 * The props of a part that renders a tag or a component in place of its own element. The props
 * type of the part omits `as` from the attributes of its element, because motion-v adds an `as`
 * to `HTMLAttributes` of Vue.
 */
export interface AsProps {
  // The SFC compiler of Vue cannot read `keyof HTMLElementTagNameMap`, and it reads the second
  // argument of `Extract`. The runtime type of the prop then has `String`, so a tag passes the prop
  // check of an app in development.
  /**
   * A tag or a component that the part renders in place of its own element, with the same
   * attributes and content. The `element` slot wins over it.
   */
  as?: Extract<keyof HTMLElementTagNameMap, string> | Component;
}

/**
 * The scope of the `element` slot of a part. Bind `props` on the element with `v-bind`, and give
 * `elementRef` to its `ref`.
 */
export interface ElementSlotProps<State> {
  props: Record<string, unknown>;
  elementRef: (target: unknown) => void;
  state: State;
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
 * The native element of a component, from the function ref `setElement`. Bind `setElement` with
 * `:ref`, because Vapor ignores `ref` in `v-bind`. `element` is the element that `setElement` got.
 * For a component, it is the `element` that the component exposes, else its root element `$el`,
 * which a Vapor component does not have. It is `null` on a server, before the mount and after the
 * unmount. A part uses it, and a component of yours that exposes `element` can be the element of a
 * part.
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
export function isElement(value: unknown): value is Element {
  return value != null && (value as Partial<Node>).nodeType === 1;
}

/** Compares two nodes by their order in the document, for `sort`. */
export function byDocumentOrder(a: Node, b: Node) {
  return a.compareDocumentPosition(b) & a.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
