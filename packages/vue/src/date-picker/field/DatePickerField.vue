<script lang="ts">
import type { DateFieldRootProps, DateFieldRootState } from '../../date-field/types';

export interface DatePickerFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar, the time zone and the props of the form.
 */
export interface DatePickerFieldProps extends Omit<
  DateFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'min'
  | 'max'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'timeZone'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/DateFieldRoot.vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { usePickerPartElement } from '../../internals/date-time/picker/usePickerPartElement';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { givenAttributes } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import { useFormReset } from '../../internals/useFormReset';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootValue,
} from '../root/DatePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<DatePickerFieldProps>();

defineSlots<{
  default(props: { state: DatePickerFieldState }): unknown;
}>();

const picker = useDatePickerRootContext();
const popup = usePickerPopup();

interface DateFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

// This part renders `DateField.Root` and makes no element of its own.
const field = useTemplateRef<DateFieldActions>('field');
const element = computed(() => field.value?.element ?? null);
const inputElement = computed(() => field.value?.inputElement ?? null);

usePickerPartElement(picker.fields, element);

// The field holds the input of the form, so it hears about the reset.
useFormReset(inputElement, (event) => {
  picker.reset(createChangeEventDetails(REASONS.none, event));
});

function handleKeydown(event: KeyboardEvent) {
  if (
    event.altKey &&
    event.key === 'ArrowDown' &&
    !event.defaultPrevented &&
    !picker.disabled.value &&
    !picker.props.readOnly
  ) {
    event.preventDefault();
    popup.openByKey(event);
  }
}

function handleValueChange(
  value: DatePickerRootValue | null,
  details: DatePickerRootChangeEventDetails,
) {
  picker.commit(value, details);
}

const fieldHandlers = { onKeydown: handleKeydown };

function fieldProps(attributes: Record<string, unknown>) {
  const root = picker.props;
  return {
    ...mergeProps(fieldHandlers, givenAttributes(attributes)),
    ...props,
    modelValue: picker.value.value,
    // The default value gives the kind of a new value, the same kind as for the calendar.
    defaultValue: picker.template.value,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    min: root.minDate,
    max: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: root.disabled,
    readonly: root.readOnly,
    required: root.required,
    name: root.name,
    form: root.form,
  };
}

// `clear()` of the field root gives only `update:modelValue`, so the part commits the change.
function clear() {
  field.value?.clear();
  if (picker.value.value !== null) handleValueChange(null, createChangeEventDetails(REASONS.none));
}

defineExpose({
  element,
  inputElement,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear,
});
</script>

<template>
  <DateFieldRoot
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))"
    @value-change="handleValueChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DateFieldRoot>
</template>
