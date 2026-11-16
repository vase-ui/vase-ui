<script lang="ts">
import type {
  DateFieldRootProps,
  DateFieldRootState,
} from '../../date-field/root/DateFieldRoot.vue';

export interface DateRangePickerStartFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar, the time zone and the props of the form. The part
 * has the attribute `aria-labelledby` in the place of the prop `ariaLabelledby`.
 */
export interface DateRangePickerStartFieldProps extends Omit<
  DateFieldRootProps,
  | 'value'
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
  | 'ariaLabelledby'
> {}
</script>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/root/DateFieldRoot.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useDateRangePickerField } from '../utils/useDateRangePickerField';
import type { DateFieldActions } from '../utils/useDateRangePickerField';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerStartFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DateRangePickerStartFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerStartFieldState>;
}>();

// This part renders `DateField.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `DateField.Root` dynamic. Vue then renders `DateField.Root` again each time this part renders.
const field = useTemplateRef<DateFieldActions>('field');
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
    v-bind="fieldProps()"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </DateFieldRoot>
  <DateFieldRoot v-else ref="field" v-bind="fieldProps()" @value-change="handleValueChange">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DateFieldRoot>
</template>
