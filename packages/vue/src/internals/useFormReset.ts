import { watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { useTimeout } from '../common/useTimeout';

/**
 * Calls `onReset` after a native reset of the form of `input`. Call it in `setup`.
 *
 * The browser resets the controls after the listeners of the `reset` event, and a listener that
 * runs later can still prevent the event. `onReset` thus runs in a timeout of 0 ms, and only when
 * no listener prevented the event. It does not run when the event is for another form.
 * @param input The element of a control that has a `form`, such as a hidden `<input>`. A ref that a
 * `ref` setter writes.
 * @param onReset Gets the `reset` event.
 */
export function useFormReset(
  input: Readonly<Ref<HTMLElement | null>>,
  onReset: (event: Event) => void,
): void {
  const resetTimeout = useTimeout();

  watch(
    input,
    (element, _previous, onCleanup) => {
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

      onCleanup(
        mergeCleanups(
          // A `reset` event does not leave a shadow root, so the listener is on the root node.
          addEventListener(element.getRootNode(), 'reset', handleReset),
          resetTimeout.clear,
        ),
      );
    },
    { flush: 'post' },
  );
}
