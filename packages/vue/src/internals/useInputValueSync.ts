import { watch } from 'vue';
import type { Ref } from 'vue';

export interface InputValueSync {
  handledValue: () => string | undefined;
  record: () => void;
  recordAs: (value: string | undefined) => void;
  isNew: (event: Event) => boolean;
  write: () => void;
}

/**
 * Vue writes the value at a render. A refused change can leave the input with a value that the
 * part does not show. The part calls `write` after that change, then the next event sees the
 * value that the browser kept. An assignment to an equal value would mark the input dirty.
 */
export function useInputValueSync(
  input: () => Element | null,
  expected: () => string | undefined,
): InputValueSync {
  let lastValue: string | undefined;

  return {
    handledValue: () => lastValue,
    record() {
      lastValue = (input() as HTMLInputElement | null)?.value;
    },
    recordAs(value) {
      lastValue = value;
    },
    isNew(event) {
      const value = (event.currentTarget as HTMLInputElement).value;
      const changed = value !== lastValue;
      lastValue = value;
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
      lastValue = element?.value;
    },
  };
}

/** Records the state for a new hidden input until the part can take its value from before hydration. */
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
        // The input type can change the text that Vue wrote.
        sync.record();
      }
    },
    { flush: 'post' },
  );
  return sync;
}
