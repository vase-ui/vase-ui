<script lang="ts">
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootProps,
  RangeCalendarRootState,
} from '../../range-calendar/root/RangeCalendarRoot.vue';

export interface DateRangePickerCalendarState extends RangeCalendarRootState {}

/**
 * The props of `RangeCalendar.Root` that the picker does not own. The root of the picker owns the
 * range, the limits, the locale, the calendar, the time zone and the states `disabled` and
 * `readOnly`. The calendar takes the focus when the popup opens, so it has no `autoFocus`.
 */
export interface DateRangePickerCalendarProps extends Omit<
  RangeCalendarRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'minDate'
  | 'maxDate'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'timeZone'
  | 'disabled'
  | 'readOnly'
  | 'autoFocus'
> {}
</script>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue';
import { RangeCalendarHostContext } from '../../range-calendar/root/RangeCalendarRootContext';
import type { DateValue } from '../../internals/date-time/temporal';
import {
  PickerCalendarOwner,
  providePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { givenAttributes } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import RangeCalendarRoot from '../../range-calendar/root/RangeCalendarRoot.vue';
import type { DateRangePickerRange } from '../root/DateRangePickerRootContext';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';
import type { DateRangePickerRootChangeEventDetails } from '../root/DateRangePickerRoot.vue';

defineOptions({ inheritAttrs: false });

// Vue gives an absent Boolean prop the value `false`. The default of `showOutsideDays` depends on
// `broadcastCalendar`, so the part keeps it `undefined`.
const props = withDefaults(defineProps<DateRangePickerCalendarProps>(), {
  as: 'div',
  showOutsideDays: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DateRangePicker.Calendar');
}

const emit = defineEmits<{
  /**
   * Callback fired when the month that the grid shows changes.
   */
  monthChange: [month: Temporal.PlainYearMonth, eventDetails: RangeCalendarRootChangeEventDetails];
  /**
   * Event handler called after `monthChange` with the new month, unless a listener cancels the
   * change. `v-model:month` uses it.
   */
  'update:month': [month: Temporal.PlainYearMonth];
  /**
   * Callback fired when the day that has the tab stop changes.
   */
  focusedDateChange: [date: Temporal.PlainDate, eventDetails: RangeCalendarRootChangeEventDetails];
  /**
   * Event handler called after `focusedDateChange` with the new day, unless a listener cancels the
   * change. `v-model:focusedDate` uses it.
   */
  'update:focusedDate': [date: Temporal.PlainDate];
}>();

defineSlots<{
  default(props: { state: DateRangePickerCalendarState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerCalendarState>;
}>();

const picker = useDateRangePickerRootContext();
const popup = usePickerPopup();

const calendar = useTemplateRef<{
  element: HTMLElement | null;
  focus: (date?: DateValue) => void;
}>('calendar');
const element = computed(() => calendar.value?.element ?? null);

providePickerControl(PickerCalendarOwner);

// The first press makes a range with one end, and the popup stays open for the second press. A drag
// makes the whole range in one change. A key that extends the range does not close the popup,
// because the user can extend the range more.
function handleValueChange(
  range: DateRangePickerRange,
  details: DateRangePickerRootChangeEventDetails,
) {
  picker.commit(range, details);
  if (
    !details.isCanceled &&
    picker.closeOnSelect.value &&
    range[0] !== null &&
    range[1] !== null &&
    (details.reason === REASONS.dayPress || details.reason === REASONS.drag)
  ) {
    popup.closeAfterSelection(details.event);
  }
}

// A drag that makes the range that the picker already has gives no change, so the calendar tells
// the picker, and the picker closes as it does after a change.
provide(RangeCalendarHostContext, {
  onSameRange(event) {
    if (picker.closeOnSelect.value) {
      popup.closeAfterSelection(event);
    }
  },
});

const calendarProps = computed(() => {
  const root = picker.props;
  return {
    ...props,
    modelValue: picker.value.value,
    defaultValue: [picker.template.value, picker.template.value] as const,
    minDate: root.minDate,
    maxDate: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: picker.disabled.value,
    readOnly: root.readOnly,
  };
});

defineExpose({
  element,
  /** Gives the focus to `date`, or to the day that has the tab stop. */
  focus: (date?: DateValue): void => calendar.value?.focus(date),
});
</script>

<template>
  <RangeCalendarRoot
    v-if="$slots.render"
    ref="calendar"
    v-bind="{ ...givenAttributes(withoutPropsOf($attrs, RangeCalendarRoot)), ...calendarProps }"
    @month-change="(month, details) => emit('monthChange', month, details)"
    @update:month="(month) => emit('update:month', month)"
    @focused-date-change="(day, details) => emit('focusedDateChange', day, details)"
    @update:focused-date="(day) => emit('update:focusedDate', day)"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </RangeCalendarRoot>
  <RangeCalendarRoot
    v-else
    ref="calendar"
    v-bind="{ ...givenAttributes(withoutPropsOf($attrs, RangeCalendarRoot)), ...calendarProps }"
    @month-change="(month, details) => emit('monthChange', month, details)"
    @update:month="(month) => emit('update:month', month)"
    @focused-date-change="(day, details) => emit('focusedDateChange', day, details)"
    @update:focused-date="(day) => emit('update:focusedDate', day)"
    @value-change="handleValueChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </RangeCalendarRoot>
</template>
