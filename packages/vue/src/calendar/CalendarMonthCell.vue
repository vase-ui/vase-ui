<script setup lang="ts">
import { formatText } from '../common/date-time/text';
import { useCell } from './cell';
import { injectCalendar } from './root';
import type { CalendarMonthCellProps, CalendarMonthCellState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthCellProps>(), { format: 'long' });
defineSlots<{
  default?(scope: { state: CalendarMonthCellState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthCellState;
    text: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const { element, setElement, state, text, elementProps } = useCell(props, {
  unit: 'month',
  cell: () => props.month,
  format: () => ({ month: props.format }),
  label: () => formatText(props.month, { month: props.format, year: 'numeric' }, calendar.locale),
});

defineExpose({ element });
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text">{{ text }}</slot>
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text">{{ text }}</slot>
  </button>
</template>
