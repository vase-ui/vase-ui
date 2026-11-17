import { onScopeDispose, watch } from 'vue';
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
  const { isHeld, shown } = useKeepAliveState();
  // The `ref` setter runs in the patch of the part. Vue 3.5.12 tracks a reactive read in a `sync`
  // `watch` callback. A read of `isHeld.value` in `registerInput` makes the render of the part
  // depend on `isHeld`.
  let held = isHeld.value;
  let release: (() => void) | void;

  function releaseInput() {
    release?.();
    release = undefined;
  }

  function registerInput(element: HTMLInputElement | null) {
    releaseInput();
    if (element && !held) {
      release = register(element);
    }
  }

  // The input registers in its `ref` setter, so an `onMounted` hook of a hydration sees it. A
  // hydration runs these hooks before the jobs of the default flush.
  watch(input, registerInput, { flush: 'sync' });

  // The release runs in the `onDeactivated` hook of `KeepAlive`, so an `onUpdated` hook of the same
  // flush sees no held input.
  watch(
    isHeld,
    (nextHeld) => {
      held = nextHeld;
      if (nextHeld) {
        releaseInput();
      }
    },
    { flush: 'sync' },
  );

  watch(shown, () => registerInput(input.value));

  // Vue stops the watchers of a part before it calls the `ref` setter of the unmount.
  onScopeDispose(releaseInput);

  return {
    isHeld,
    updateInputRegistration() {
      if (!held) {
        registerInput(input.value);
      }
    },
  };
}
