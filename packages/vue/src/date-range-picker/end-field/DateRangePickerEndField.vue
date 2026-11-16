<script lang="ts">
import type { DateFieldRootState } from '../../date-field/root/DateFieldRoot.vue';
import type { DateRangePickerStartFieldProps } from '../start-field/DateRangePickerStartField.vue';

export interface DateRangePickerEndFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. They are the props of
 * `DateRangePicker.StartField`. A date in this field that is before the first day of the range makes
 * the field invalid.
 */
export interface DateRangePickerEndFieldProps extends DateRangePickerStartFieldProps {}
</script>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/root/DateFieldRoot.vue';
import { provideLabelableContext } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useDateRangePickerField } from '../utils/useDateRangePickerField';
import type { DateFieldActions } from '../utils/useDateRangePickerField';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerEndFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DateRangePickerEndFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerEndFieldState>;
}>();

// A `Field` has one control that its label names, and the start field is that control. This field
// has a labelable context of its own, so it has an id of its own. The label of the `Field` does not
// name it. The descriptions and the errors of the `Field` still reach it.
provideLabelableContext();

// This part renders `DateField.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `DateField.Root` dynamic. Vue then renders `DateField.Root` again each time this part renders.
const field = useTemplateRef<DateFieldActions>('field');
const { element, inputElement, handleValueChange, fieldProps } = useDateRangePickerField(
  'end',
  field,
  props,
  'End date',
);

defineExpose({
  element,
  inputElement,
  /** Sets the last day of the range to `null` and empties each segment. The reason of the change is `none`. */
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
