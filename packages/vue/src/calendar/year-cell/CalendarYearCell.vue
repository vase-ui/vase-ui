<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { CalendarCellState } from '../../internals/date-time/calendar/viewPages';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface CalendarYearCellState extends CalendarCellState {}

export interface CalendarYearCellProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarYearCellState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The year that the part shows, as the first month of that year. It is an item of the slot `row`
   * of `Calendar.YearGrid`.
   */
  year: Temporal.PlainYearMonth;
  /**
   * The format of the year in the text of the button.
   * @default 'numeric'
   */
  format?: 'numeric' | '2-digit' | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { useCalendarCell } from '../utils/CalendarViewGridContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearCellProps>(), {
  as: 'button',
  nativeButton: true,
  format: 'numeric',
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.YearCell');
}

defineSlots<{
  default(props: { state: CalendarYearCellState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarYearCellState; text: string }): unknown;
}>();

const root = useCalendarRootContext();

const state = computed<CalendarYearCellState>(() => root.getYearState(props.year));

const { element, elementProps, setRef, usesRenderSlot, text } = useCalendarCell({
  props,
  cell: () => props.year,
  state,
  format: () => ({ year: props.format }),
  press: (event) => root.pressYear(props.year, event),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :text="text" />
  <component
    :is="as"
    v-else-if="$slots.default || as !== 'button'"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <button v-else v-bind="elementProps()" :ref="setRef">{{ text }}</button>
</template>
