<script setup lang="ts">
import { computed } from 'vue';
import { toPlainTime } from '../common/date-time/temporal';
import { clampTime } from '../time-clock/views';
import { columnText, selectedColumnValue, timeOfColumnValue } from './columns';
import { columnKey, injectListbox } from './listbox';
import { useOption } from './option';
import { injectTimePicker } from './root';
import type { TimePickerColumnItemProps, TimePickerColumnItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerColumnItemProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: TimePickerColumnItemState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerColumnItemState;
    text: string;
  }): unknown;
}>();

const picker = injectTimePicker('ColumnItem');
const column = injectListbox(columnKey, 'ColumnItem', 'Column');
const option = useOption(picker, column, {
  part: 'ColumnItem',
  key: () => String(props.value),
  selected: () =>
    picker.value !== null &&
    selectedColumnValue(column.unit, picker.hourCycle, toPlainTime(picker.value)) === props.value,
  ownDisabled: () => props.disabled,
  disabled: () => props.disabled || column.outOfLimits(props.value),
  // A press sets the unit, keeps the other units, and puts the time into the limits.
  time: () =>
    clampTime(timeOfColumnValue(column.unit, picker.hourCycle, picker.time, props.value), {
      minTime: picker.props.min,
      maxTime: picker.props.max,
    }),
  as: () => props.as,
});
const { setElement, state, elementProps } = option;
const text = computed(() =>
  columnText(column.unit, picker.hourCycle, props.value, picker.locale),
);

defineExpose({ element: option.element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :text="text"
  />
  <component :is="as" v-else-if="as && $slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text" />
  </component>
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">{{
    text
  }}</component>
  <button v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text" />
  </button>
  <button v-else v-bind="elementProps()" :ref="setElement">{{ text }}</button>
</template>
