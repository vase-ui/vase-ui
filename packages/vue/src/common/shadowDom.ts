import { isElement, isShadowRoot } from '@floating-ui/utils/dom';

// Goes down through open shadow roots. For a closed shadow root, `shadowRoot` is `null`.
export function activeElement(doc: Document) {
  let element = doc.activeElement;

  while (element?.shadowRoot?.activeElement != null) {
    element = element.shadowRoot.activeElement;
  }

  return element;
}

export function contains(parent?: Element | null, child?: Element | null) {
  if (!parent || !child) {
    return false;
  }

  const rootNode = child.getRootNode?.();

  // The native method is faster, so try it first.
  if (parent.contains(child)) {
    return true;
  }

  // Then walk out of the shadow roots.
  if (rootNode && isShadowRoot(rootNode)) {
    let next = child;
    while (next) {
      if (parent === next) {
        return true;
      }
      next = (next.parentNode as Element) || (next as unknown as ShadowRoot).host;
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

    current =
      (current as Element).assignedSlot ??
      current.parentNode ??
      (isShadowRoot(current) ? current.host : null);
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
