import { onUnmounted, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { ownerWindow } from '../../../common/owner';

export interface ElementSiblings {
  /** The nodes before the element, in the order of the document. */
  before?: readonly ChildNode[] | undefined;
  /** The nodes after the element, in the order of the document. */
  after?: readonly ChildNode[] | undefined;
}

/**
 * Keeps nodes that the caller made beside the element of a part. The part then has one root node,
 * so the scope id, the directives and the `Transition` of a consumer apply to its element.
 *
 * `siblings` gives the same object while the nodes do not change. `null` removes the nodes.
 */
export function useElementSiblings(
  element: MaybeRefOrGetter<HTMLElement | null>,
  siblings: MaybeRefOrGetter<ElementSiblings | null>,
): void {
  let placed: readonly ChildNode[] = [];
  let observer: MutationObserver | null = null;
  let observedParent: Node | null = null;

  function remove() {
    observer?.disconnect();
    observer = null;
    observedParent = null;
    for (const node of placed) {
      node.remove();
    }
    placed = [];
  }

  function place() {
    const target = toValue(element);
    const next = toValue(siblings);
    const parent = target?.parentNode ?? null;
    if (!target || !parent || !next) {
      remove();
      return;
    }

    const before = next.before ?? [];
    const after = next.after ?? [];
    const nodes = [...before, ...after];
    for (const node of placed) {
      if (!nodes.includes(node)) {
        node.remove();
      }
    }
    placed = nodes;

    // Each write has a condition. A callback of the observer that finds the nodes in their places
    // thus makes no mutation, and the observer does not call it again.
    let reference: ChildNode = target;
    for (let index = before.length - 1; index >= 0; index -= 1) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop runs from the last index to 0.
      const node = before[index]!;
      if (reference.previousSibling !== node) {
        reference.before(node);
      }
      reference = node;
    }
    reference = target;
    for (const node of after) {
      if (reference.nextSibling !== node) {
        reference.after(node);
      }
      reference = node;
    }

    // Vue moves only the element when a parent moves the part or `KeepAlive` holds it, and Vue
    // puts a new node of a list immediately before the element. The observer then puts the nodes
    // back in a microtask of the same DOM update.
    if (observedParent !== parent) {
      observer?.disconnect();
      observer = new (ownerWindow(target).MutationObserver)(place);
      observer.observe(parent, { childList: true });
      observedParent = parent;
    }
  }

  watch([() => toValue(element), () => toValue(siblings)], place, { flush: 'post' });

  // Vue reads the node after the element as the place of a part that replaces this part, and it
  // inserts the new part after the `onBeforeUnmount` hooks and after the effect scope stops. The
  // nodes thus stay until the DOM update is complete.
  onUnmounted(remove);
}
