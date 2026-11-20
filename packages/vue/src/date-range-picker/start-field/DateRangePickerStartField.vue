<script lang="ts">
import type { DateFieldRootProps, DateFieldRootState } from '../../date-field/types';

export interface DateRangePickerStartFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar, the time zone and the props of the form. The default
 * name of the field is `Start date`. The label of a `Field` joins that name.
 */
export interface DateRangePickerStartFieldProps extends Omit<
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
import { useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/DateFieldRoot.vue';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { useDateRangePickerField } from '../utils/useDateRangePickerField';
import type { DateFieldActions } from '../utils/useDateRangePickerField';

defineOptions({ inheritAttrs: false });

const props = defineProps<DateRangePickerStartFieldProps>();

defineSlots<{
  default(props: { state: DateRangePickerStartFieldState }): unknown;
}>();

// This part renders `DateField.Root` and makes no element of its own.
const field = useTemplateRef<DateFieldActions>('field');
const { element, inputElement, handleValueChange, fieldProps, clear } = useDateRangePickerField(
  'start',
  field,
  props,
  'Start date',
);

defineExpose({
  element,
  inputElement,
  /** Sets the first day of the range to `null` and empties each segment. The reason of the change is `none`. */
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
