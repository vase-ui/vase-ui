import { computed, onMounted, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useFieldsetRootContext } from './FieldsetRootContext';

interface FieldsetObserver {
  observer: MutationObserver;
  callbacks: Set<() => void>;
}

// The map is in the module, so each copy of the library has its own observers.
const fieldsetObservers = new WeakMap<Node, FieldsetObserver>();

// HTML has no event for a change of the disabled state of a fieldset. All callbacks of one root
// node share one observer. A new first `<legend>` and a move of the element also change the state.
function observeFieldsets(root: Node, callback: () => void): () => void {
  let fieldsetObserver = fieldsetObservers.get(root);

  if (!fieldsetObserver) {
    const callbacks = new Set<() => void>();
    const observer = new MutationObserver(() => {
      callbacks.forEach((run) => run());
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
    fieldsetObserver = { observer, callbacks };
    fieldsetObservers.set(root, fieldsetObserver);
  }

  const { observer, callbacks } = fieldsetObserver;
  callbacks.add(callback);

  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      observer.disconnect();
      fieldsetObservers.delete(root);
    }
  };
}

/**
 * Whether HTML disables a form control at the place of `element`. A `<fieldset disabled>` disables
 * each control in it, except a control in its first `<legend>` child.
 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#concept-fe-disabled
 */
function isInDisabledFieldset(element: Element): boolean {
  for (
    let fieldset = element.parentElement?.closest('fieldset');
    fieldset;
    fieldset = fieldset.parentElement?.closest('fieldset')
  ) {
    if (fieldset.disabled && !fieldset.querySelector(':scope > legend')?.contains(element)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a fieldset disables the part of `element`: `Fieldset.Root` with `disabled`, or a native
 * `<fieldset disabled>` as HTML says. Call it in `setup`. The part knows a native fieldset only
 * after its mount, so the server HTML follows `Fieldset.Root` only.
 */
export function useFieldsetDisabled(
  element: MaybeRefOrGetter<Element | null | undefined>,
): ComputedRef<boolean> {
  const fieldset = useFieldsetRootContext(true);
  const isNativeFieldsetDisabled = shallowRef(false);
  // `KeepAlive` moves the DOM of a held part into a detached element, out of each fieldset above
  // the branch. The part keeps its state until the activation.
  const { isHeld } = useKeepAliveState();

  // A part declares its element after it calls this composable, and a `watch` reads its sources at
  // once. The `watch` thus starts at the mount.
  onMounted(() => {
    watch(
      [() => toValue(element), isHeld],
      ([partElement, held], _previous, onCleanup) => {
        if (!partElement || held) {
          return;
        }

        let observedRoot: Node | undefined;
        let stopObserver: (() => void) | undefined;

        // `Teleport` can move the element into another document or shadow root. A part that mounts
        // in a held branch is in a detached element until its first activation. The observer of the
        // old root node sees each such move, and the new root node then gets the observer.
        const update = () => {
          isNativeFieldsetDisabled.value = isInDisabledFieldset(partElement);
          const root = partElement.getRootNode();
          if (root !== observedRoot) {
            stopObserver?.();
            observedRoot = root;
            stopObserver = observeFieldsets(root, update);
          }
        };

        update();
        onCleanup(() => stopObserver?.());
      },
      { flush: 'post', immediate: true },
    );
  });

  return computed(() => (fieldset?.disabled.value ?? false) || isNativeFieldsetDisabled.value);
}
