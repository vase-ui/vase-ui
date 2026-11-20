<script setup lang="ts" generic="Value extends DateValue = Temporal.PlainDate">
import { computed, inject, mergeProps, provide, useAttrs } from 'vue';
import { calendarKey, useCalendar } from '../calendar/root';
import { useElement, type ElementSlotProps } from '../common/element';
import { assertTemporal } from '../internals/date-time/temporal';
import type { DateValue } from '../internals/date-time/temporal';
import { rangeCalendarHostKey } from './host';
import { useRange } from './range';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootProps,
  RangeCalendarRootState,
  RangeCalendarRootValue,
} from './types';

defineOptions({ inheritAttrs: false });

assertTemporal('RangeCalendar.Root');

const props = withDefaults(defineProps<RangeCalendarRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  month: undefined,
  focusedDate: undefined,
  showOutsideDays: undefined,
});
const emit = defineEmits<{
  /** The user changes the range. `details.cancel()` keeps the range as it is. */
  valueChange: [value: RangeCalendarRootValue<Value>, details: RangeCalendarRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: RangeCalendarRootValue<Value>];
  /** The user moves the page. `details.cancel()` keeps the page. */
  monthChange: [month: Temporal.PlainYearMonth, details: RangeCalendarRootChangeEventDetails];
  /** Comes after `monthChange`, and for a move with no user event. `v-model:month` uses it. */
  'update:month': [month: Temporal.PlainYearMonth];
  /** A day gets the focus, or a key moves it. `details.cancel()` keeps the focused day. */
  focusedDateChange: [date: Temporal.PlainDate, details: RangeCalendarRootChangeEventDetails];
  /** Comes after `focusedDateChange`, and for a move with no user event. `v-model:focusedDate` uses it. */
  'update:focusedDate': [date: Temporal.PlainDate];
}>();
defineSlots<{
  default?(scope: { state: RangeCalendarRootState }): unknown;
  element?(scope: ElementSlotProps<RangeCalendarRootState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const range = useRange(
  props,
  emit as (event: 'valueChange' | 'update:modelValue', ...args: unknown[]) => void,
  inject(rangeCalendarHostKey, null),
);
const {
  calendar: forParts,
  rootState,
  focus,
  rootProps,
  dayAt,
} = useCalendar(props, {
  part: 'RangeCalendar.Root',
  emit,
  element,
  views: false,
  selection: range.selection,
  dayButtonProps: (day) => range.dayButtonProps(day, dayAt),
  onTargetRemoved: (target) => range.dropDragOf(target.element),
});
provide(calendarKey, forParts);

const state = computed<RangeCalendarRootState>(() => ({
  ...rootState.value,
  selecting: range.selecting.value,
}));

defineExpose({ element, focus });

// The root handles Escape for each element in it, such as a navigation button.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && range.cancel(event)) event.preventDefault();
}

function elementProps() {
  return mergeProps(
    rootProps(),
    { 'data-selecting': state.value.selecting ? '' : undefined, onKeydown },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
