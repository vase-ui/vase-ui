<script lang="ts">
import type {
  TimeFieldRootProps,
  TimeFieldRootState,
} from '../../time-field/root/TimeFieldRoot.vue';

export interface TimePickerFieldState extends TimeFieldRootState {}

/**
 * The props of `TimeField.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the props of the form.
 */
export interface TimePickerFieldProps extends Omit<
  TimeFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'minTime'
  | 'maxTime'
  | 'locale'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { usePickerField } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type { PickerFieldActions } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { givenAttributes } from '../../internals/givenAttributes';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import TimeFieldRoot from '../../time-field/root/TimeFieldRoot.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TimePickerFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerFieldState>;
}>();

const picker = useTimePickerRootContext();
const field = useTemplateRef<PickerFieldActions>('field');
const { element, inputElement, fieldHandlers } = usePickerField(field, picker.fields, picker);

function fieldProps(attributes: Record<string, unknown>) {
  const root = picker.props;
  return {
    ...mergeProps(fieldHandlers, givenAttributes(attributes)),
    ...props,
    modelValue: picker.value.value,
    // The default value gives the kind of a new value, the same kind as for each other part.
    defaultValue: picker.template.value,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    minTime: root.minTime,
    maxTime: root.maxTime,
    locale: root.locale,
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
  <TimeFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, TimeFieldRoot))"
    @value-change="picker.commit"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
  <TimeFieldRoot
    v-else
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, TimeFieldRoot))"
    @value-change="picker.commit"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
</template>
