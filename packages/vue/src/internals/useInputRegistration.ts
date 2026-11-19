import { shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { useKeepAliveState } from './useKeepAliveState';

export function useInputRegistration(
  input: Readonly<Ref<HTMLInputElement | null>>,
  register: (input: HTMLInputElement) => (() => void) | void,
) {
  const { isHeld } = useKeepAliveState();
  const registrationVersion = shallowRef(0);

  // Hydration and ancestor deactivation hooks must see the current input in the same task.
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
