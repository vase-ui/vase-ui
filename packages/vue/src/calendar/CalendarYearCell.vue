<script setup lang="ts">
import { useCell } from './cell';
import type { CalendarYearCellProps, CalendarYearCellState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearCellProps>(), { format: 'numeric' });
defineSlots<{
  default?(scope: { state: CalendarYearCellState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarYearCellState;
    text: string;
  }): unknown;
}>();

const { element, setElement, state, text, elementProps } = useCell(props, {
  unit: 'year',
  cell: () => props.year,
  format: () => ({ year: props.format }),
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
