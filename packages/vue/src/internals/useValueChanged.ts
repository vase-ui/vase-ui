import { onActivated, onDeactivated, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

/**
 * Calls `onChange` with the previous value when `value` changes. It does not call `onChange` at the
 * mount. Call it in `setup`.
 *
 * `onChange` runs after the DOM update of the change, because the callback of a field control reads
 * the validity of its input. A change under `KeepAlive` waits for the activation. `onChange` then
 * gets the value from before the deactivation.
 * @param value A ref or a getter. `setup` runs one time, so a plain value never changes.
 */
export function useValueChanged<T>(
  value: MaybeRefOrGetter<T>,
  onChange: (previousValue: T) => void,
): void {
  // A variable and not the old value of `watch`: a change while `KeepAlive` has the part deactivated
  // must give the value from before the deactivation.
  let previousValue = toValue(value);
  // `KeepAlive` takes the DOM of a deactivated part out of the document, and `onChange` can read
  // that DOM. A change waits for the activation.
  const isDeactivated = shallowRef(false);

  onDeactivated(() => {
    isDeactivated.value = true;
  });

  onActivated(() => {
    isDeactivated.value = false;
  });

  watch(
    [() => toValue(value), isDeactivated],
    ([nextValue, deactivated]) => {
      if (deactivated) {
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
