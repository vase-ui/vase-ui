import { shallowRef, watch } from 'vue';

/**
 * When no change waits for a render yet, a parent listener later in the same event can change a
 * model. `nextTick` runs before that render, and this post watcher runs after it
 * (test/measurements/input.test.ts).
 */
export function useAfterRender() {
  const requests = shallowRef(0);
  const callbacks: (() => void)[] = [];
  watch(
    requests,
    () => {
      for (const callback of callbacks.splice(0)) callback();
    },
    { flush: 'post' },
  );
  return (callback: () => void) => {
    callbacks.push(callback);
    requests.value += 1;
  };
}
