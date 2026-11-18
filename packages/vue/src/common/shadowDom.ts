import { isElement, isShadowRoot } from '@floating-ui/utils/dom';

// Goes down through open shadow roots. For a closed shadow root, `shadowRoot` is `null`.
export function activeElement(doc: Document) {
  let element = doc.activeElement;

  while (element?.shadowRoot?.activeElement != null) {
    element = element.shadowRoot.activeElement;
  }

  return element;
}

function getComposedParent(node: Node): Node | null {
  return (
    (node as Element | Text).assignedSlot ??
    node.parentNode ??
    (isShadowRoot(node) ? node.host : null)
  );
}

export function contains(parent?: Element | null, child?: Element | null) {
  if (!parent || !child) {
    return false;
  }

  // A slot adds ancestors in another root. Within one root, the native check suffices.
  const root = child.getRootNode?.();
  if (root && root === parent.getRootNode?.()) {
    return parent.contains(child);
  }

  for (let node: Node | null = child; node; node = getComposedParent(node)) {
    if (node === parent) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the closest matching element in the composed tree, through slots and shadow roots.
 * It does not support `:scope`.
 */
export function closest<K extends keyof HTMLElementTagNameMap>(
  node: Node | null | undefined,
  selector: K,
): HTMLElementTagNameMap[K] | null;
export function closest<K extends keyof SVGElementTagNameMap>(
  node: Node | null | undefined,
  selector: K,
): SVGElementTagNameMap[K] | null;
export function closest<E extends Element = Element>(
  node: Node | null | undefined,
  selector: string,
): E | null;
export function closest(node: Node | null | undefined, selector: string): Element | null {
  let current = node;

  while (current) {
    if (isElement(current) && current.matches(selector)) {
      return current;
    }

    current = getComposedParent(current);
  }

  return null;
}

export function getTarget(event: Event) {
  if ('composedPath' in event) {
    // The composed path is empty after dispatch, so use `target` then.
    return event.composedPath()[0] ?? event.target;
  }

  // TypeScript assumes that `composedPath` always exists.
  // An old browser with no shadow DOM does not have it.
  return (event as Event).target;
}
