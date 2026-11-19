<script lang="ts">
import type {
  DateFieldRootProps,
  DateFieldRootState,
} from '../../date-field/root/DateFieldRoot.vue';

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
import { usePickerField } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type { PickerFieldActions } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { givenAttributes } from '../../internals/givenAttributes';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DatePickerFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerFieldState>;
}>();

const picker = useDatePickerRootContext();
const field = useTemplateRef<PickerFieldActions>('field');
const { element, inputElement, fieldHandlers } = usePickerField(field, picker.fields, picker);

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
    minDate: root.minDate,
    maxDate: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: root.disabled,
    readOnly: root.readOnly,
    required: root.required,
    name: root.name,
    form: root.form,
  };
}

defineExpose({
  element,
  inputElement,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear: () => field.value?.clear(),
});
</script>

<template>
  <DateFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))"
    @value-change="picker.commit"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </DateFieldRoot>
  <DateFieldRoot
    v-else
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))"
    @value-change="picker.commit"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DateFieldRoot>
</template>
