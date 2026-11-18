import { watch } from 'vue';
import type { Ref } from 'vue';

export interface InputValueSync {
  /** The value that the input had at the last record. */
  handledValue: () => string | undefined;
  /** Records the value of the input. It reads no argument, so a watcher can call it. */
  record: () => void;
  /** Records `value` in place of the value of the input. */
  recordAs: (value: string | undefined) => void;
  /** Records the value of the input of the event. Gives `false` when the record had that value. */
  isNew: (event: Event) => boolean;
  /** Writes the expected text to an input that has another value. Then records. */
  write: () => void;
}

/**
 * Vue writes the value of an input only when the part renders. The part does not render when a
 * listener cancels a change, the consumer keeps its value or the part refuses the text. The input
 * then keeps a value that the part does not show, and the part calls `write` after the change.
 * With an expected value of `undefined`, `write` only records. `write` assigns no equal value,
 * because each assignment sets the dirty value flag of the input.
 *
 * A program can send `change` for a value that the part handled with `input`, or only `change`.
 * The record is the value of the input after the last event that the part handled, and after the
 * last write of Vue, of the part or of a reset. An event with that value is not new.
 */
export function useInputValueSync(
  input: () => Element | null,
  expected: () => string | undefined,
): InputValueSync {
  let handled: string | undefined;

  return {
    handledValue: () => handled,
    record() {
      handled = (input() as HTMLInputElement | null)?.value;
    },
    recordAs(value) {
      handled = value;
    },
    isNew(event) {
      const value = (event.currentTarget as HTMLInputElement).value;
      const changed = value !== handled;
      handled = value;
      return changed;
    },
    write() {
      const element = input() as HTMLInputElement | null;
      if (element) {
        const value = expected();
        if (value !== undefined && element.value !== value) {
          element.value = value;
        }
      }
      handled = element?.value;
    },
  };
}

/**
 * For a root that renders a hidden `value` input. Until the take of the hydration, a new input
 * can hold a value that the root did not handle. The record is then the text of the state, so the
 * `input` event of the take has a new value.
 * @param writes The result of `useHiddenValueBeforeHydration` for the input.
 */
export function useHiddenInputValueSync(
  input: Readonly<Ref<HTMLInputElement | null>>,
  expected: () => string,
  writes: Readonly<Ref<boolean>>,
): InputValueSync {
  const sync = useInputValueSync(() => input.value, expected);
  watch(
    [input, expected, writes],
    ([element, value, canWrite], [previousElement]) => {
      if (element !== previousElement && !canWrite) {
        sync.recordAs(value);
      } else {
        // The value sanitization of the input type can change the text that Vue wrote.
        sync.record();
      }
    },
    { flush: 'post' },
  );
  return sync;
}
