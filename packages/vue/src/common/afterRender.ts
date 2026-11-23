import { shallowRef, watch } from 'vue';

/**
 * Gives a function that runs its callback after the next render, also when no change waits for a
 * render yet. A listener of the parent can run after the listener of the part, in the same event,
 * and change a model there. The callback then runs after the render of that change. `nextTick` in
 * the listener of the part runs before that render (test/measurements/input.test.ts). Call it in
 * `setup`.
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
