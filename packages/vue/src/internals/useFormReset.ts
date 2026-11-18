import { toValue, watch, watchPostEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
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
 * listener of a shown part follows the input to another root node.
 * @param input A control with a `form`, or a ref or getter for that control.
 * @param onReset Gets the `reset` event.
 */
export function useFormReset(
  input: MaybeRefOrGetter<HTMLElement | null>,
  onReset: (event: Event) => void,
): void {
  const resetTimeout = useTimeout();
  const { isHeld } = useKeepAliveState();

  watch(() => toValue(input), resetTimeout.clear);

  watchPostEffect((onCleanup) => {
    const element = toValue(input);
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

    // A `reset` event does not leave a shadow root, so a shown part listens on the root node.
    // The change of `isHeld` starts this listener at activation. A leave transition keeps a
    // held input in the document until it ends, and no hook runs at that end. A form in the
    // held branch moves with the input, so a held part listens on the form of the input.
    if (isHeld.value) {
      const form = (element as HTMLInputElement).form;
      if (form) {
        onCleanup(listen(form));
      }
    } else {
      onCleanup(followRootNode(element, listen));
    }
  });
}
