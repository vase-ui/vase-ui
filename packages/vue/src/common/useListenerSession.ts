import { shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

type Attach = (onCleanup: (release: () => void) => void, end: () => void) => void;

export function useListenerSession(isHeld: MaybeRefOrGetter<boolean>) {
  const current = shallowRef<{ attach: Attach } | null>(null);
  const stop = () => {
    current.value = null;
  };

  watch(
    [() => toValue(isHeld), current],
    ([held, session], _, onCleanup) => {
      if (held) {
        stop();
      } else if (session) {
        session.attach(onCleanup, () => {
          if (current.value === session) stop();
        });
      }
    },
    { flush: 'sync' },
  );

  return {
    start(attach: Attach) {
      current.value = { attach };
    },
    stop,
  };
}
