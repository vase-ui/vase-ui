<script lang="ts">
import type { DateFieldRootState } from '../../date-field/root/DateFieldRoot.vue';
import type { DateRangePickerStartFieldProps } from '../start-field/DateRangePickerStartField.vue';

export interface DateRangePickerEndFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. They are the props of
 * `DateRangePicker.StartField`. A value in this field that is before the first end of the range makes
 * the field invalid. A field that shows a time compares the time too, and two zoned ends compare
 * by the moment.
 */
export interface DateRangePickerEndFieldProps extends DateRangePickerStartFieldProps {}
</script>

<script setup lang="ts">
import { inject, provide, useTemplateRef } from 'vue';
import DateFieldRoot from '../../date-field/root/DateFieldRoot.vue';
import { fieldKey } from '../../field/control';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { useDateRangePickerField } from '../utils/useDateRangePickerField';
import type { DateFieldActions } from '../utils/useDateRangePickerField';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerEndFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DateRangePickerEndFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerEndFieldState>;
}>();

// A `Field` has one control that its label names, and the start field is that control. This field
// gets the name, the state and the descriptions of the `Field`, as an item of a group does, and has
// no part in its control, its label or its value. `useDateRangePickerField` reads the label of the `Field` and
// joins it to the name of this field.
const outerField = inject(fieldKey, null);
if (outerField) {
  provide(fieldKey, {
    get disabled() {
      return outerField.disabled;
    },
    // Both hidden inputs take the name of the `Field`.
    get name() {
      return outerField.name;
    },
    controlId: undefined,
    labelId: undefined,
    labelledBy: undefined,
    get describedBy() {
      return outerField.describedBy;
    },
    get state() {
      return outerField.state;
    },
    setControl: () => () => {},
    setValue() {},
    onEdit() {},
    onLeave() {},
    onReset() {},
  });
}

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
