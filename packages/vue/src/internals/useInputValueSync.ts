import { shallowRef, toValue, watch } from 'vue';
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
  /** Gives the `value` key of the input. The part calls it in the render of the input. */
  bind: <Value>(value: Value) => { value: Value };
  /** Starts a render of the input. Vue writes the `value` key there, and the composable records. */
  restore: () => void;
}

/**
 * At each render of an input, Vue writes the `value` key to an input that has another value. The
 * part does not render when a listener cancels a change, the consumer keeps its value or the part
 * refuses the text. The input then keeps a value that the part does not show. The part calls
 * `restore` after such a change, and the render that called `bind` runs again. The part assigns
 * no value to the input.
 *
 * A program can send `change` for a value that the part handled with `input`, or only `change`.
 * The record is the value of the input after the last event that the part handled, and after the
 * last write of Vue or of a reset. An event with that value is not new.
 */
export function useInputValueSync(input: () => Element | null): InputValueSync {
  let handled: string | undefined;
  const restores = shallowRef(0);

  function record() {
    handled = (input() as HTMLInputElement | null)?.value;
  }
  watch(restores, record, { flush: 'post' });

  return {
    handledValue: () => handled,
    record,
    recordAs(value) {
      handled = value;
    },
    isNew(event) {
      const value = (event.currentTarget as HTMLInputElement).value;
      const changed = value !== handled;
      handled = value;
      return changed;
    },
    bind(value) {
      toValue(restores);
      return { value };
    },
    restore() {
      restores.value += 1;
    },
  };
}

export interface HiddenInputValueSync extends InputValueSync {
  /** Gives the `value` key of the input, and no key until the input accepts writes. */
  valueProps: () => { value: string } | undefined;
}

/**
 * For a root that renders a hidden `value` input. Until the take of the hydration, a new input
 * can hold a value that the root did not handle. The record is then the text of the state, so the
 * `input` event of the take has a new value.
 * @param expected Gives the text of the state.
 * @param writes The result of `useHiddenValueBeforeHydration` for the input.
 */
export function useHiddenInputValueSync(
  input: Readonly<Ref<HTMLInputElement | null>>,
  expected: () => string,
  writes: Readonly<Ref<boolean>>,
): HiddenInputValueSync {
  const sync = useInputValueSync(() => input.value);
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
  return { ...sync, valueProps: () => (writes.value ? sync.bind(expected()) : undefined) };
}
