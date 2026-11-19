<script lang="ts">
import type {
  DateFieldRootProps,
  DateFieldRootState,
} from '../../date-field/root/DateFieldRoot.vue';

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
  | 'minDate'
  | 'maxDate'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'timeZone'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/root/DateFieldRoot.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { useDateRangePickerField } from '../root/DateRangePickerRootContext';
import type { PickerFieldActions } from '../../internals/date-time/picker/useDateTimePickerRoot';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerStartFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DateRangePickerStartFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerStartFieldState>;
}>();

const field = useTemplateRef<PickerFieldActions>('field');
const { element, inputElement, handleValueChange, fieldProps } = useDateRangePickerField(
  'start',
  field,
  props,
  'Start date',
);

defineExpose({
  element,
  inputElement,
  /** Sets the first day of the range to `null` and empties each segment. The reason of the change is `none`. */
  clear: () => field.value?.clear(),
});
</script>

<template>
  <DateFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </DateFieldRoot>
  <DateFieldRoot
    v-else
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))"
    @value-change="handleValueChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DateFieldRoot>
</template>
