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
 * Call in `setup`. The setter clears the target only while it holds the element of this part.
 * By default it gives `null` while `KeepAlive` holds the part and the current element at activation.
 * A part that mounts in a held branch gives no element until activation.
 * Use `keepWhileHeld` when a reader needs the element of a held part.
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
      // Vue stops the scope before the ref callback gets null at unmount.
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
