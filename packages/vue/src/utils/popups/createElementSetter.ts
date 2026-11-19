import { shallowRef, toRaw, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { resolveElement } from '../../internals/resolveElement';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import type { PopupStoreState, PopupTriggerDataStore } from './usePopupRoot';

/** A ref or a store entry that holds the element of a part. */
export interface ElementTarget {
  value: HTMLElement | null;
  /**
   * Receives the element even when the part mounts in a branch that `KeepAlive` holds.
   * Supply this target only for a reader that needs the held element.
   */
  kept?: ElementTarget | undefined;
}

/**
 * Makes the `ref` setter of a part that gives its element to a target of its root. Call it in
 * `setup`. The setter takes an element or a component that exposes `element`.
 *
 * The setter clears a target only if it still holds this part's element. By default, the part
 * releases `value` during a hold and gives it the current element at activation.
 *
 * The optional `kept` target receives the element even when the part mounts in a held branch.
 * Set `keepWhileHeld` when a reader of `value` needs the element during the hold.
 */
export function createElementSetter(
  target: ElementTarget,
  { keepWhileHeld = false }: { keepWhileHeld?: boolean | undefined } = {},
): (value: Element | ComponentPublicInstance | null) => void {
  const element = shallowRef<HTMLElement | null>(null);
  const isHeld = keepWhileHeld ? undefined : useKeepAliveState().isHeld;
  const setKept = target.kept && createElementSetter(target.kept, { keepWhileHeld: true });

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

  return (value) => {
    const given = resolveElement(value) as HTMLElement | null;
    element.value = given;
    setKept?.(given);
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

/** Makes the targets for the popup element of the store and for the transition of a held popup. */
export function popupElementTarget(
  store: PopupTriggerDataStore<PopupStoreState<unknown>>,
): ElementTarget {
  return {
    kept: store.context.keptPopupRef,
    get value() {
      return toRaw(store.state).popupElement;
    },
    set value(popup) {
      store.context.popupRef.value = popup;
      store.set('popupElement', popup);
    },
  };
}
