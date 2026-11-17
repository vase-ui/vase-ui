import { shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { useKeepAliveState } from '../useKeepAliveState';

export interface UseInputRegistrationReturnValue {
  /**
   * Whether `KeepAlive` holds the part.
   */
  isHeld: Readonly<Ref<boolean>>;
  /**
   * Registers the input again, unless `KeepAlive` holds the part. Call it when `register` gives
   * another registration for the same input.
   */
  updateInputRegistration: () => void;
}

/**
 * Registers the input of a part with the owners of the input, such as its field and its group.
 * Call it in `setup`. The `ref` setter of the input writes `input`.
 *
 * `KeepAlive` takes the input out of the document and calls no `ref` setter. An owner must not use
 * an input that the user cannot reach: a held required input would block the submit of its form.
 * The composable registers no input while `KeepAlive` holds the part, releases a registered input
 * at the hold, and registers the input at each activation.
 * @param input The input of the part.
 * @param register Registers the input and returns the function that releases it.
 */
export function useInputRegistration(
  input: Readonly<Ref<HTMLInputElement | null>>,
  register: (input: HTMLInputElement) => (() => void) | void,
): UseInputRegistrationReturnValue {
  const { isHeld } = useKeepAliveState();
  const registrationVersion = shallowRef(0);

  // One run of this `watch` owns one registration, and its cleanup releases it. Vue runs the
  // cleanup before the next run and when the part unmounts.
  // With `flush: 'sync'`, the input registers in its `ref` setter, so an `onMounted` hook of a
  // hydration sees it. A hydration runs these hooks before the jobs of the default flush. The
  // release runs in the `onDeactivated` hook of `KeepAlive`, so an `onUpdated` hook of the same
  // flush sees no held input.
  // `isHeld` is a source, and the callback does not read it. The `ref` setter runs in the patch of
  // the part, and Vue 3.5.12 tracks a reactive read in a `sync` `watch` callback. Such a read would
  // make the render of the part depend on `isHeld`.
  watch(
    [input, isHeld, registrationVersion],
    ([element, held], _previous, onCleanup) => {
      if (!element || held) {
        return;
      }

      const release = register(element);
      if (release) {
        onCleanup(release);
      }
    },
    { flush: 'sync' },
  );

  return {
    isHeld,
    updateInputRegistration() {
      registrationVersion.value += 1;
    },
  };
}
