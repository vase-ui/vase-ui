import { watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useTimeout } from '../common/useTimeout';
import { followRootNode } from './observeRootNode';
import { useKeepAliveState } from './useKeepAliveState';

/**
 * Calls `onReset` after a native reset of the form of `input`. Call it in `setup`.
 *
 * The browser resets the controls after the listeners of the `reset` event, and a listener that
 * runs later can still prevent the event. `onReset` thus runs in a timeout of 0 ms, and only when
 * no listener prevented the event. It does not run when the event is for another form. The
 * listener follows the input to another root node.
 * @param input The element of a control that has a `form`, such as a hidden `<input>`. A ref that a
 * `ref` setter writes.
 * @param onReset Gets the `reset` event.
 */
export function useFormReset(
  input: Readonly<Ref<HTMLElement | null>>,
  onReset: (event: Event) => void,
): void {
  const resetTimeout = useTimeout();
  const { isHeld } = useKeepAliveState();

  watch(input, () => {
    resetTimeout.clear();
  });

  watch(
    [input, isHeld] as const,
    ([element, held], _previous, onCleanup) => {
      if (!element) {
        return;
      }

      function handleReset(event: Event) {
        // The form of the input can change, so the form is read when the event arrives.
        if (event.target !== (element as HTMLInputElement).form) {
          return;
        }

        resetTimeout.start(0, () => {
          if (!event.defaultPrevented) {
            onReset(event);
          }
        });
      }

      function listen(target: Node) {
        return addEventListener(target, 'reset', handleReset);
      }

      // A reset stays in its shadow root. A leave transition can keep a held input in the
      // document until it ends. No hook runs at that end, but the held form moves with the input.
      if (held) {
        const form = (element as HTMLInputElement).form;
        if (form) {
          onCleanup(listen(form));
        }
      } else {
        onCleanup(followRootNode(element, listen));
      }
    },
    { flush: 'post' },
  );
}
