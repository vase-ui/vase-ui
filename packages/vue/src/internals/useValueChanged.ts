import { toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from './useKeepAliveState';

/**
 * Calls `onChange` with the previous value when `value` changes. It does not call `onChange` at the
 * mount. Call it in `setup`.
 *
 * `onChange` runs after the DOM update of the change, because the callback of a field control reads
 * the validity of its input. A change while `KeepAlive` holds the part waits for the activation.
 * `onChange` then gets the value from before the hold, or the value of the mount when the part
 * mounts in a held branch.
 * @param value A ref or a getter. `setup` runs one time, so a plain value never changes.
 */
export function useValueChanged<T>(
  value: MaybeRefOrGetter<T>,
  onChange: (previousValue: T) => void,
): void {
  // A variable and not the old value of `watch`: a change while `KeepAlive` holds the part must give
  // the value from before the hold.
  let previousValue = toValue(value);
  // `KeepAlive` takes the DOM of a held part out of the document, and `onChange` can read that
  // DOM. A change waits for the activation.
  const { isHeld } = useKeepAliveState();

  watch(
    [() => toValue(value), isHeld],
    ([nextValue, held]) => {
      if (held) {
        return;
      }

      // `watch` also runs for `0` to `-0`, because it compares with `Object.is`.
      if (previousValue !== nextValue) {
        onChange(previousValue);
      }

      previousValue = nextValue;
    },
    { flush: 'post' },
  );
}
