<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface CalendarDayButtonState extends DayState {}

export interface CalendarDayButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarDayButtonState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The format of the date that names the button. The default is the weekday, the day, the month
   * and the year in full.
   */
  format?: Intl.DateTimeFormatOptions | undefined;
}
</script>

<script setup lang="ts">
import { useDayButton } from '../../internals/date-time/calendar/useDayButton';
import type { HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useCalendarDayContext } from '../day/CalendarDayContext';
import { dayStateAttributesMapping } from '../day/stateAttributesMapping';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarDayButtonProps>(), {
  as: 'button',
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.DayButton');
}

defineSlots<{
  default(props: { state: CalendarDayButtonState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarDayButtonState; text: string }): unknown;
}>();

const root = useCalendarRootContext();
const { day, state } = useCalendarDayContext();
const { isLeaving } = useCalendarMonthContext();

const { element, elementProps, text } = useDayButton(props, {
  root,
  day,
  state,
  isLeaving,
  stateAttributesMapping: dayStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <template v-if="!state.hidden">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
    <component :is="as" v-else-if="$slots.default || as !== 'button'" v-bind="elementProps()"
      ><slot :state="state" :text="text">{{ text }}</slot></component
    >
    <button v-else v-bind="elementProps()">{{ text }}</button>
  </template>
</template>
