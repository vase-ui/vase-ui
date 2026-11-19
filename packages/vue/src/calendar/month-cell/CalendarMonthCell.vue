<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { CalendarCellState } from '../../internals/date-time/calendar/viewPages';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface CalendarMonthCellState extends CalendarCellState {}

export interface CalendarMonthCellProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarMonthCellState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The month that the part shows. It is an item of the slot `row` of `Calendar.MonthGrid`.
   */
  month: Temporal.PlainYearMonth;
  /**
   * The format of the name of the month in the text of the button. The name of the button is that
   * text and the year, so the visible text is part of the name.
   * @default 'long'
   */
  format?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit' | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { formatText } from '../../internals/date-time/calendar/formatText';
import type { HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { useCalendarCell } from '../utils/CalendarViewGridContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthCellProps>(), {
  as: 'button',
  nativeButton: true,
  format: 'long',
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.MonthCell');
}

defineSlots<{
  default(props: { state: CalendarMonthCellState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarMonthCellState; text: string }): unknown;
}>();

const root = useCalendarRootContext();

const state = computed<CalendarMonthCellState>(() => root.getMonthState(props.month));

const { element, elementProps, setRef, usesRenderSlot, text } = useCalendarCell({
  props,
  cell: () => props.month,
  state,
  format: () => ({ month: props.format }),
  label: () => formatText(props.month, { month: props.format, year: 'numeric' }, root.locale.value),
  press: (event) => root.pressMonth(props.month, event),
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
