import { watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useTimeout } from '../common/useTimeout';
import { useKeepAliveState } from './useKeepAliveState';

/**
 * Calls `onReset` after a native reset of the form of `input`. Call it in `setup`.
 *
 * The browser resets the controls after the listeners of the `reset` event, and a listener that
 * runs later can still prevent the event. `onReset` thus runs in a timeout of 0 ms, and only when
 * no listener prevented the event. It does not run when the event is for another form. The
 * listener follows the input when `KeepAlive` moves it out of the document and back.
 * @param input The element of a control that has a `form`, such as a hidden `<input>`. A ref that a
 * `ref` setter writes.
 * @param onReset Gets the `reset` event.
 */
export function useFormReset(
  input: Readonly<Ref<HTMLElement | null>>,
  onReset: (event: Event) => void,
): void {
  const resetTimeout = useTimeout();
  const { isHeld, shown } = useKeepAliveState();

  watch(input, () => {
    resetTimeout.clear();
  });

  watch(
    [input, isHeld, shown] as const,
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

      // A `reset` event does not leave a shadow root, so a shown part listens on the root node.
      // `KeepAlive` calls no `ref` setter when it moves the input, so the `watch` also runs at each
      // activation. A leave transition keeps a held input in the document until it ends, and no
      // hook runs at that end. A form in the held branch moves with the input, so a held part
      // listens on the form of the input.
      const target = held ? (element as HTMLInputElement).form : element.getRootNode();
      if (target) {
        onCleanup(addEventListener(target, 'reset', handleReset));
      }
    },
    { flush: 'post' },
  );
}
