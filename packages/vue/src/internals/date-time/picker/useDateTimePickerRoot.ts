import { computed, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue';
import { useControlled } from '../../../common/useControlled';

/** What a picker root gives to its parts. The root of a family adds the props that its parts share. */
export interface DateTimePickerContext<Value, Details extends { isCanceled: boolean }> {
  /** The value of the picker, or `null` while it has none. */
  value: ComputedRef<Value | null>;
  /**
   * The value that gives the kind, the calendar, the time and the time zone of a new value: the
   * value, else the default value, else the last value that the picker had, else the fallback. Each
   * part that makes a value, such as the field and the calendar, gets it as its default value, so a
   * new value has the same kind whichever part makes it.
   */
  template: ComputedRef<Value>;
  /**
   * Applies a change that a part reports. The root emits `valueChange` with the details of the
   * part, so a `details.cancel()` of a listener also stops the change of the part. Then the root
   * emits `update:value` and takes the value.
   */
  commit: (value: Value | null, details: Details) => void;
  /**
   * A native reset of the form. An uncontrolled picker goes back to its default value. The field
   * that holds the input of the form calls it.
   */
  reset: (details: Details) => void;
  /** Whether a selection closes the popup. */
  closeOnSelect: ComputedRef<boolean>;
  /** The element that the popup is positioned against: the element of the field. */
  fieldElement: ShallowRef<HTMLElement | null>;
}

export interface UseDateTimePickerRootParameters<Value, Details extends { isCanceled: boolean }> {
  /** The name of the root part, for the messages about a change from controlled to uncontrolled. */
  part: string;
  value: MaybeRefOrGetter<Value | null | undefined>;
  defaultValue: MaybeRefOrGetter<Value | null | undefined>;
  /** The value that gives the kind of a new value when the picker has never had a value. */
  fallback: MaybeRefOrGetter<Value>;
  closeOnSelect: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether a value has a time. A selection of such a value keeps the popup open by default,
   * because the user then sets the time.
   */
  hasTime: (value: Value) => boolean;
  /** Called with each new value. A call of `details.cancel()` keeps the old value. */
  valueChange: (value: Value | null, details: Details) => void;
  /** Called after `valueChange`, unless a listener canceled the change. */
  updateValue: (value: Value | null) => void;
}

/**
 * The state that each picker root shares: its value, the rule that closes the popup and the field
 * that the popup is positioned against. The root of a family calls it in `setup`, after
 * `assertTemporal`, and gives the result to its parts. The open state is not here: the root renders
 * a popover root, and its parts read the store of that root.
 */
export function useDateTimePickerRoot<Value, Details extends { isCanceled: boolean }>(
  parameters: UseDateTimePickerRootParameters<Value, Details>,
): DateTimePickerContext<Value, Details> {
  const [value, setValue] = useControlled<Value | null>({
    controlled: () => toValue(parameters.value),
    default: () => toValue(parameters.defaultValue) ?? null,
    name: parameters.part,
    state: 'value',
  });

  // A value that becomes `null` keeps its kind for the next value, as a calendar does.
  const lastValue = shallowRef<Value>();
  watch(
    value,
    (current) => {
      if (current !== null) {
        lastValue.value = current;
      }
    },
    { immediate: true, flush: 'sync' },
  );
  const template = computed(
    () =>
      value.value ??
      toValue(parameters.defaultValue) ??
      lastValue.value ??
      toValue(parameters.fallback),
  );

  function commit(next: Value | null, details: Details) {
    parameters.valueChange(next, details);
    if (details.isCanceled) {
      return;
    }
    parameters.updateValue(next);
    setValue(next);
  }

  // A controlled picker does not change. The field of a controlled picker also does not change for
  // a reset, so the parent decides.
  function reset(details: Details) {
    if (toValue(parameters.value) === undefined) {
      commit(toValue(parameters.defaultValue) ?? null, details);
    }
  }

  const closeOnSelect = computed(
    () => toValue(parameters.closeOnSelect) ?? !parameters.hasTime(template.value),
  );

  return {
    value,
    template,
    commit,
    reset,
    closeOnSelect,
    fieldElement: shallowRef<HTMLElement | null>(null),
  };
}
