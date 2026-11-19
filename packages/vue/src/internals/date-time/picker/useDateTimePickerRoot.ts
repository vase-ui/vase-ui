import { computed, inject, provide, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useControlled } from '../../../common/useControlled';
import { useInDisabledFieldset } from '../../../fieldset/part';
import { fieldKey } from '../../../field/control';
import { PickerResetCountContext } from '../field/PickerResetCountContext';
import { createPickerPartElements } from './usePickerPartElement';
import type { PickerPartElements } from './usePickerPartElement';

/** What a picker root gives to its parts. The root of a family adds the props that its parts share. */
export interface DateTimePickerContext<Value, Details extends { isCanceled: boolean }> {
  /** The value of the picker, or `null` while it has none. */
  value: ComputedRef<Value | null>;
  /**
   * The value that gives the kind, the calendar, the time and the time zone of a new value: the
   * value, else the default value, else the last value that the picker had, else the fallback.
   */
  template: ComputedRef<Value>;
  /**
   * Applies a change that a part reports. The root emits `valueChange` with the details of the
   * part, so a `details.cancel()` of a listener also stops the change of the part. Then the root
   * emits `update:modelValue` and takes the value.
   */
  commit: (value: Value | null, details: Details) => void;
  /**
   * A native reset of the form. An uncontrolled picker goes back to its default value. The field
   * that holds the input of the form calls it.
   */
  reset: (details: Details) => void;
  /** Whether a selection closes the popup. */
  closeOnSelect: ComputedRef<boolean>;
  /** The fields that give the popup its anchor and the root its native fieldset. */
  fields: PickerPartElements;
  /** A picker with no field reads its native fieldset at the first trigger in the document. */
  triggers: PickerPartElements;
  /**
   * Whether the picker ignores user interaction: its `disabled` prop, or a disabled field or
   * fieldset around it.
   */
  disabled: ComputedRef<boolean>;
}

export interface UseDateTimePickerRootParameters<Value, Details extends { isCanceled: boolean }> {
  /** The root name for the warning when its default value changes. */
  part: string;
  value: MaybeRefOrGetter<Value | null | undefined>;
  defaultValue: MaybeRefOrGetter<Value | null | undefined>;
  /** The value that gives the kind of a new value when the picker has never had a value. */
  fallback: MaybeRefOrGetter<Value>;
  closeOnSelect: MaybeRefOrGetter<boolean | undefined>;
  /** The disabled prop of the root. */
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * Whether a value has a time. A selection of such a value keeps the popup open by default,
   * because the user then sets the time.
   */
  hasTime: (value: Value) => boolean;
  /**
   * Whether a value gives no kind to a new value, such as a range that has no end. With no function,
   * only `null` gives none.
   */
  isEmpty?: ((value: Value) => boolean) | undefined;
  /** Called with each new value. A call of `details.cancel()` keeps the old value. */
  valueChange: (value: Value | null, details: Details) => void;
  /** Called after `valueChange`, unless a listener canceled the change. */
  updateValue: (value: Value | null) => void;
}

/**
 * Gives each picker its value, its disabled state, its rule for a selection and its field and
 * trigger registries. The root calls it in `setup` after `assertTemporal`. Its parts read the
 * open state from the popover store. Its field roots get the reset count from `PickerResetCountContext`.
 */
export function useDateTimePickerRoot<Value, Details extends { isCanceled: boolean }>(
  parameters: UseDateTimePickerRootParameters<Value, Details>,
): DateTimePickerContext<Value, Details> {
  const value = useControlled<Value | null>({
    controlled: () => toValue(parameters.value),
    default: () => toValue(parameters.defaultValue) ?? null,
    name: parameters.part,
    state: 'value',
  });

  // A value that becomes empty keeps its kind for the next value, as a calendar does.
  function filled(candidate: Value | null | undefined): Value | undefined {
    return candidate == null || parameters.isEmpty?.(candidate) ? undefined : candidate;
  }
  const lastValue = shallowRef<Value>();
  watch(
    value,
    (current) => {
      const next = filled(current);
      if (next !== undefined) {
        lastValue.value = next;
      }
    },
    { immediate: true, flush: 'sync' },
  );
  const template = computed(
    () =>
      filled(value.value) ??
      filled(toValue(parameters.defaultValue)) ??
      lastValue.value ??
      toValue(parameters.fallback),
  );

  function commit(next: Value | null, details: Details) {
    parameters.valueChange(next, details);
    if (details.isCanceled) {
      return;
    }
    parameters.updateValue(next);
    value.value = next;
  }

  // The field roots get the value of a reset with the next render, so the count comes first.
  const resetCount = shallowRef(0);
  provide(PickerResetCountContext, resetCount);

  // A controlled picker does not change. The field of a controlled picker also does not change for
  // a reset, so the parent decides.
  function reset(details: Details) {
    if (toValue(parameters.value) === undefined) {
      resetCount.value += 1;
      commit(toValue(parameters.defaultValue) ?? null, details);
    }
  }

  const closeOnSelect = computed(
    () => toValue(parameters.closeOnSelect) ?? !parameters.hasTime(template.value),
  );

  const fields = createPickerPartElements();
  const triggers = createPickerPartElements();
  const field = inject(fieldKey, null);
  const fieldsetDisabled = useInDisabledFieldset(() => fields.first.value ?? triggers.first.value);
  const disabled = computed(
    () => toValue(parameters.disabled) || !!field?.disabled || fieldsetDisabled.value,
  );

  return { value, template, commit, reset, closeOnSelect, fields, triggers, disabled };
}
