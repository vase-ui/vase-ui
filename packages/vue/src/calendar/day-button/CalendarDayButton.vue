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
import { useDayButton } from './useDayButton';
import type { HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useCalendarDayContext, dayStateAttributesMapping } from '../root/CalendarRootContext';

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

const { day, state } = useCalendarDayContext();

const { element, elementProps, setRef, usesRenderSlot, text } = useDayButton(props, {
  day,
  state,
  stateAttributesMapping: dayStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="!state.hidden && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
    :text="text"
  />
  <component
    :is="as"
    v-else-if="!state.hidden && ($slots.default || as !== 'button')"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <button v-else-if="!state.hidden" v-bind="elementProps()" :ref="setRef">{{ text }}</button>
</template>
