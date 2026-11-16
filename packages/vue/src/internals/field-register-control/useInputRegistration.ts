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
 * The registration thus ends when `KeepAlive` holds the part. The input registers again at each
 * activation.
 * @param input The input of the part.
 * @param register Registers the input and returns the function that releases it.
 */
export function useInputRegistration(
  input: Readonly<Ref<HTMLInputElement | null>>,
  register: (input: HTMLInputElement) => (() => void) | void,
): UseInputRegistrationReturnValue {
  const { isHeld, shown } = useKeepAliveState();
  let release: (() => void) | void;

  function releaseInput() {
    release?.();
    release = undefined;
  }

  function registerInput(element: HTMLInputElement | null) {
    releaseInput();
    if (element) {
      release = register(element);
    }
  }

  // The input registers in its `ref` setter. At a hydration, Vue runs the `onMounted` hooks before
  // the jobs of the default flush.
  watch(input, registerInput, { flush: 'sync' });

  watch(
    isHeld,
    (held) => {
      if (held) {
        releaseInput();
      }
    },
    { flush: 'sync' },
  );

  // The `ref` setter of a part that mounts in a held branch registers the input.
  watch(input, () => {
    if (isHeld.value) {
      releaseInput();
    }
  });

  watch(shown, () => registerInput(input.value));

  // Vue stops the watchers of a part before it calls the `ref` setter of the unmount.
  onScopeDispose(releaseInput);

  return {
    isHeld,
    updateInputRegistration() {
      if (!isHeld.value) {
        registerInput(input.value);
      }
    },
  };
}
