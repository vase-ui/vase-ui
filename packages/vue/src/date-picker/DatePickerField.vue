<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import type { DateTimeFieldChangeEventDetails } from '../common/date-time-field/field';
import { usePickerField } from '../common/picker/field';
import DateFieldRoot from '../date-field/DateFieldRoot.vue';
import { injectDatePicker } from './root';
import type { DatePickerFieldProps, DatePickerFieldState, DatePickerRootValue } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DatePickerFieldProps>();
defineSlots<{ default?(scope: { state: DatePickerFieldState }): unknown }>();

const picker = injectDatePicker('Field');
const attrs = useAttrs();
const field = usePickerField(picker, 'Field');

function fieldProps() {
  const root = picker.props;
  return mergeProps(attrs, {
    modelValue: picker.value,
    defaultValue: picker.template,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    min: root.min,
    max: root.max,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: picker.disabled,
    readonly: root.readonly,
    required: root.required,
    name: root.name,
    form: root.form,
    onValueChange: (value: DatePickerRootValue | null, details: DateTimeFieldChangeEventDetails) =>
      picker.commit(value, details, true),
    onKeydown: field.onKeydown,
  });
}

defineExpose({
  element: field.element,
  /** The input that gives the value to a form. */
  inputElement: field.inputElement,
  /** Empties each segment. `update:modelValue` follows when the picker had a value. */
  clear() {
    field.clearSegments();
    picker.set(null);
  },
});
</script>

<template>
  <DateFieldRoot :ref="field.setField" v-bind="fieldProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </DateFieldRoot>
</template>
