import { isShadowRoot } from '@floating-ui/utils/dom';
import { ownerDocument } from './owner';

interface TreeObserver {
  observer: MutationObserver;
  callbacks: Set<() => void>;
}

// Each observer of a root gets each record, so the controls of one root share an observer.
// The map is in the module, so each copy of the library has its own observers.
const treeObservers = new WeakMap<Node, Map<string, TreeObserver>>();

export function isDocumentOrShadowRoot(root: Node): root is Document | ShadowRoot {
  return root.nodeType === root.DOCUMENT_NODE || isShadowRoot(root);
}

function observeTree(root: Node, callback: () => void, attributeFilter?: readonly string[]) {
  let observers = treeObservers.get(root);
  if (!observers) {
    observers = new Map();
    treeObservers.set(root, observers);
  }

  const key = attributeFilter ? JSON.stringify(attributeFilter) : '';
  let shared = observers.get(key);
  if (!shared) {
    const callbacks = new Set<() => void>();
    const observer = new MutationObserver(() => callbacks.forEach((run) => run()));
    observer.observe(root, {
      childList: true,
      subtree: true,
      ...(attributeFilter && { attributeFilter: [...attributeFilter] }),
    });
    shared = { observer, callbacks };
    observers.set(key, shared);
  }

  const { observer, callbacks } = shared;
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      observer.disconnect();
      observers.delete(key);
    }
  };
}

/**
 * Calls `callback` after a child list or listed attribute changes in the root tree of `element`.
 * It calls back after a move to another root. The initial subscription makes no call.
 * In a detached tree it also observes the last document or shadow root, or the owner document
 * if the element had neither. When the consumer attaches that tree in another root, such as
 * another shadow root, neither observer gets a record.
 * The returned function stops both observations.
 */
export function observeRootNode(
  element: Element,
  callback: () => void,
  attributeFilter?: readonly string[],
): () => void {
  let root: Node | undefined;
  let attachedRoot: Document | ShadowRoot | undefined;
  // eslint-disable-next-line no-restricted-syntax -- The DOM observer moves this subscription in the mutation microtask.
  let stopAttached: (() => void) | undefined;
  // eslint-disable-next-line no-restricted-syntax -- The DOM observer follows the detached tree in the same microtask.
  let stopDetached: (() => void) | undefined;

  function updateObservers() {
    const next = element.getRootNode();
    if (next === root) {
      return;
    }
    root = next;
    const attached = isDocumentOrShadowRoot(root) ? root : (attachedRoot ?? ownerDocument(element));
    if (attached !== attachedRoot) {
      stopAttached?.();
      attachedRoot = attached;
      stopAttached = observeTree(attached, handleChange, attributeFilter);
    }
    stopDetached?.();
    stopDetached = root === attached ? undefined : observeTree(root, handleChange, attributeFilter);
  }

  function handleChange() {
    // A label lookup can write an id in the new root. Its new observer must miss that write.
    callback();
    if (stopAttached) {
      updateObservers();
    }
  }

  updateObservers();
  return () => {
    stopAttached?.();
    stopAttached = undefined;
    stopDetached?.();
    stopDetached = undefined;
  };
}

/**
 * Calls `effect` with the root node of `element` at once and after each root change.
 * It runs the previous cleanup before the next effect. The returned stop runs the last cleanup.
 * In a detached tree it follows attachment to the last document or shadow root, or the owner
 * document if the element had neither. When the consumer attaches that tree in another root, it
 * gets no record.
 */
export function followRootNode(
  element: Element,
  effect: (root: Node) => (() => void) | undefined,
): () => void {
  let root = element.getRootNode();
  // eslint-disable-next-line no-restricted-syntax -- This DOM helper releases the previous root subscription in the mutation microtask.
  let cleanup: (() => void) | undefined = effect(root);
  const stop = observeRootNode(element, () => {
    const next = element.getRootNode();
    if (next !== root) {
      cleanup?.();
      root = next;
      cleanup = effect(root);
    }
  });

  return () => {
    stop();
    cleanup?.();
    cleanup = undefined;
  };
}
