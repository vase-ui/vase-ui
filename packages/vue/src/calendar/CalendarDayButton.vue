<script setup lang="ts">
import { computed, useAttrs, watch } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { formatText } from '../internals/date-time/calendar/formatText';
import { isSameDay } from '../internals/date-time/temporal';
import { dayAttributes } from './days';
import { injectDay } from './month';
import { injectCalendar } from './root';
import type { CalendarDayButtonProps, CalendarDayButtonState } from './types';

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

defineOptions({ inheritAttrs: false });

const props = defineProps<CalendarDayButtonProps>();
defineSlots<{
  default?(scope: { state: CalendarDayButtonState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarDayButtonState;
    text: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const day = injectDay();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { waiting } = useEnterAfterLeave(() => !day.state.hidden, element);
const shown = computed(() => !day.state.hidden && !waiting.value);
// An unavailable day keeps the focus and takes no press.
const button = useButton({
  element,
  disabled: () => day.state.disabled || day.state.unavailable,
  focusableWhenDisabled: () => !day.state.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const text = computed(() => formatText(day.day, { day: 'numeric' }, calendar.locale));

watch(
  [element, () => day.day],
  ([target, date], _, onCleanup) => {
    if (target) onCleanup(calendar.addTarget({ date, element: target }));
  },
  { flush: 'post', immediate: true },
);

defineExpose({ element });

function elementProps() {
  const { state } = day;
  return button.mergeAttributes(
    {
      'aria-label': formatText(day.day, props.format ?? FULL_DATE, calendar.locale),
      'aria-current': state.today ? 'date' : undefined,
      tabindex: calendar.tabStop && isSameDay(calendar.tabStop, day.day) ? 0 : -1,
      'data-selected': state.selected ? '' : undefined,
      ...dayAttributes(state),
      ...calendar.dayButtonProps(day.day),
      onClick: (event: MouseEvent) => calendar.press(day.day, event),
    },
    attrs,
  );
}
</script>

<template>
  <template v-if="shown">
    <slot
      v-if="$slots.element"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="day.state"
      :text="text"
    />
    <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
      <slot :state="day.state" :text="text">{{ text }}</slot>
    </component>
    <button v-else v-bind="elementProps()" :ref="setElement">
      <slot :state="day.state" :text="text">{{ text }}</slot>
    </button>
  </template>
</template>
