<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarBaseProps } from '../../internals/date-time/calendar/useCalendarRoot';
import type {
  RangeChangeEventDetails,
  RangeChangeEventReason,
  RangeValue,
} from './RangeCalendarRootContext';
import type { DateValue } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import type { CalendarRootState } from '../../calendar/root/CalendarRoot.vue';

export interface RangeCalendarRootState extends CalendarRootState {
  /**
   * Whether a range is in progress: the user picked the first day and not yet the last day, or
   * drags a range.
   */
  selecting: boolean;
}

export interface RangeCalendarRootProps<Value extends DateValue = Temporal.PlainDate>
  extends
    CalendarBaseProps,
    VaseUIComponentProps<RangeCalendarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The first and the last day of the range. A range in progress has its first day and a `null`
   * last day. A new end has the kind, the time, the time zone and the calendar of the end that it
   * replaces.
   * This is the controlled counterpart of `defaultValue`.
   */
  modelValue?: readonly [Value | null, Value | null] | undefined;
  /**
   * The first and the last day of the range when the calendar first renders. With no value, it
   * also gives the kind of a new end.
   * This is the uncontrolled counterpart of `modelValue`.
   */
  defaultValue?: readonly [Value | null, Value | null] | undefined;
  /**
   * The least number of days of a range. Both ends count, so Monday to Wednesday is 3 days. A
   * press that would make a shorter range starts a new range at the pressed day.
   */
  minDays?: number | undefined;
  /**
   * The greatest number of days of a range. Both ends count. A press that would make a longer
   * range starts a new range at the pressed day. A drag stops at this number of days.
   */
  maxDays?: number | undefined;
  /**
   * Whether a range can cross a day that is disabled or unavailable. Without it, a press that
   * would make such a range starts a new range at the pressed day, and a drag stops before that
   * day. With it, the crossed day is in the range and is not selected.
   * @default false
   */
  allowNonContiguousRanges?: boolean | undefined;
}

export type RangeCalendarRootChangeEventReason = RangeChangeEventReason;
export type RangeCalendarRootChangeEventDetails = RangeChangeEventDetails;
</script>

<script setup lang="ts" generic="Value extends DateValue = Temporal.PlainDate">
import { computed, provide } from 'vue';
import {
  useRangeCalendarHost,
  useRangeSelection,
  RangeCalendarRootContext,
} from './RangeCalendarRootContext';
import { useCalendarRoot } from '../../internals/date-time/calendar/useCalendarRoot';
import { assertTemporal } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { CalendarRootContext } from '../../calendar/root/CalendarRootContext';
import { calendarRootStateAttributesMapping } from '../../calendar/root/stateAttributesMapping';
import type { CalendarState } from '../../calendar/root/CalendarRoot.vue';

defineOptions({ inheritAttrs: false });

assertTemporal('RangeCalendar.Root');

const props = withDefaults(defineProps<RangeCalendarRootProps<Value>>(), {
  as: 'div',
  modelValue: undefined,
  defaultValue: undefined,
  disabled: false,
  readOnly: false,
  invalid: false,
  autoFocus: false,
  numberOfMonths: 1,
  showOutsideDays: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('RangeCalendar.Root');
}

const emit = defineEmits<{
  /**
   * Callback fired when the range changes.
   */
  valueChange: [value: RangeValue<Value>, eventDetails: RangeCalendarRootChangeEventDetails];
  /**
   * Callback fired with the new range after `valueChange`, unless a listener cancels the change.
   * It is the event of `v-model`.
   */
  'update:modelValue': [value: RangeValue<Value>];
  /**
   * Callback fired when the month that the grid shows changes.
   */
  monthChange: [month: Temporal.PlainYearMonth, eventDetails: RangeCalendarRootChangeEventDetails];
  /**
   * Callback fired with the new month after `monthChange`, unless a listener cancels the change.
   * It is the event of `v-model:month`.
   */
  'update:month': [month: Temporal.PlainYearMonth];
  /**
   * Callback fired when the day that has the tab stop changes.
   */
  focusedDateChange: [date: Temporal.PlainDate, eventDetails: RangeCalendarRootChangeEventDetails];
  /**
   * Callback fired with the new day after `focusedDateChange`, unless a listener cancels the change.
   * It is the event of `v-model:focusedDate`.
   */
  'update:focusedDate': [date: Temporal.PlainDate];
}>();

defineSlots<{
  default(props: { state: RangeCalendarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, RangeCalendarRootState>;
}>();

const selection = useRangeSelection(props, emit, useRangeCalendarHost());
const { focus, hydrationAttributes, ...controller } = useCalendarRoot({
  part: 'RangeCalendar.Root',
  props,
  emit,
  selection,
});

// The parts get the state that they share. The root adds the state of the pages and of the range.
const state = computed<CalendarState>(() => ({
  disabled: props.disabled,
  readOnly: props.readOnly,
  invalid: props.invalid,
  empty: selection.values.value.length === 0,
}));
const rootState = computed<RangeCalendarRootState>(() => ({
  ...state.value,
  view: controller.view.value,
  multipleMonths: controller.pages.value.length > 1,
  navigationDirection: controller.navigationDirection.value,
  broadcastCalendar: props.broadcastCalendar === true,
  selecting: selection.selecting.value,
}));

provide(CalendarRootContext, { ...controller, state });
provide(RangeCalendarRootContext, selection);

// Escape ends a drag, or puts back the range from before the first press of a range in progress.
// The root handles it for each element in the calendar, such as a button that changes the month.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && selection.cancel(event)) {
    event.preventDefault();
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state: rootState,
  stateAttributesMapping: calendarRootStateAttributesMapping,
  props: (attrs) => [
    {
      role: 'group',
      // The label that the consumer gives replaces the name of the month. An `aria-labelledby` of
      // `null` gives no label, so the root keeps the name of the month.
      'aria-label': attrs['aria-labelledby'] == null ? controller.label.value : undefined,
      ...hydrationAttributes(),
      onKeydown,
    },
    attrs,
  ],
});

defineExpose({ element, focus });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="rootState" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="rootState" />
  </component>
</template>
