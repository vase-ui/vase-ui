<script setup lang="ts">
import { computed, mergeProps, provide, shallowRef, useAttrs } from 'vue';
import type { DateValue } from '../common/date-time/temporal';
import { pickerControlKey } from '../common/picker/control';
import { addPopupFocusTarget, usePickerPopup } from '../common/picker/popup';
import RangeCalendarRoot from '../range-calendar/RangeCalendarRoot.vue';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootValue,
} from '../range-calendar/types';
import { injectDateRangePicker } from './root';
import type { DateRangePickerCalendarProps, DateRangePickerCalendarState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DateRangePickerCalendarProps>();
defineSlots<{
  default?(scope: { state: DateRangePickerCalendarState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateRangePickerCalendarState;
  }): unknown;
}>();

const picker = injectDateRangePicker('Calendar');
const popup = usePickerPopup('Calendar');
const attrs = useAttrs();
type CalendarExposed = { element: HTMLElement | null; focus(date?: DateValue): void };
const calendar = shallowRef<CalendarExposed | null>(null);
function setCalendar(value: unknown) {
  calendar.value = value as CalendarExposed | null;
}

provide(pickerControlKey, {
  addFocusTarget: addPopupFocusTarget,
  onPick(event) {
    if (picker.closeOnSelect) popup.closeAfterPick(event);
  },
  // One Escape puts back the range in progress and closes the popup.
  onCancel: (event) => popup.cancel(event),
});

function calendarProps() {
  const root = picker.props;
  return mergeProps(attrs, {
    modelValue: picker.range,
    defaultValue: [picker.template, null],
    min: root.min,
    max: root.max,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: picker.calendar,
    disabled: picker.disabled,
    readonly: root.readonly,
    today: (attrs.today as DateValue | undefined) ?? picker.today ?? undefined,
    autofocus: undefined,
    onValueChange: (
      value: RangeCalendarRootValue<DateValue>,
      details: RangeCalendarRootChangeEventDetails,
    ) => picker.commit(value, details),
  });
}

defineExpose({
  element: computed(() => calendar.value?.element ?? null),
  /** Gives the focus to `date`, else to the tab stop. */
  focus: (date?: DateValue) => calendar.value?.focus(date),
});
</script>

<template>
  <RangeCalendarRoot v-if="$slots.element" :ref="setCalendar" v-bind="calendarProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </RangeCalendarRoot>
  <RangeCalendarRoot v-else :ref="setCalendar" v-bind="calendarProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </RangeCalendarRoot>
</template>
