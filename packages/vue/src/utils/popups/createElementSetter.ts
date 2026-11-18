import { shallowRef, toRaw, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { resolveElement } from '../../internals/resolveElement';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import type { PopupStoreState, PopupTriggerDataStore } from './store';

/** A ref or a store entry that holds the element of a part. */
export interface ElementTarget {
  value: HTMLElement | null;
}

/**
 * Makes the `ref` setter of a part that gives its element to a target of its root. Call it in
 * `setup`. The setter takes an element or a component that exposes `element`.
 *
 * The setter clears the target only while the target holds the element of its own part. The target
 * gets `null` while `KeepAlive` holds the part, and the element again at the activation. A part
 * that mounts in a held branch gives no element until its activation.
 *
 * With `keepWhileHeld`, the target keeps the element while `KeepAlive` holds the part. Set it only
 * when a reader of the target needs the element of a held part.
 */
export function createElementSetter(
  target: ElementTarget,
  { keepWhileHeld = false }: { keepWhileHeld?: boolean | undefined } = {},
) {
  const element = shallowRef<HTMLElement | null>(null);
  const isHeld = keepWhileHeld ? undefined : useKeepAliveState().isHeld;

  watch(
    () => (isHeld?.value ? null : element.value),
    (given, _last, onCleanup) => {
      if (given === null) {
        return;
      }
      target.value = given;
      // Vue stops the scope of a part before it calls the `ref` callback with `null` at the
      // unmount. The stopped `watch` does not run then, so the cleanup clears the target.
      onCleanup(() => {
        // A template can mount a part that replaces another part before it unmounts that part.
        if (target.value === given) {
          target.value = null;
        }
      });
    },
    { flush: 'sync' },
  );

  return (value: Element | ComponentPublicInstance | null) => {
    element.value = resolveElement(value) as HTMLElement | null;
  };
}

/** Makes the target that reads and writes one element key of a popup store. */
export function stateElementTarget<Key extends string>(
  store: PopupTriggerDataStore<PopupStoreState<unknown> & Record<Key, HTMLElement | null>>,
  key: Key,
): ElementTarget {
  return {
    get value() {
      return toRaw(store.state)[key];
    },
    set value(element) {
      store.set(key, element);
    },
  };
}

/** Makes the target of a popup part. It writes `popupRef` of the context and the key `popupElement`. */
export function popupElementTarget(
  store: PopupTriggerDataStore<PopupStoreState<unknown>>,
): ElementTarget {
  return {
    get value() {
      return toRaw(store.state).popupElement;
    },
    set value(popup) {
      store.context.popupRef.value = popup;
      store.set('popupElement', popup);
    },
  };
}
