<script setup lang="ts">
import { computed, mergeProps, provide, shallowRef, useAttrs } from 'vue';
import CalendarRoot from '../calendar/CalendarRoot.vue';
import type { CalendarRootChangeEventDetails } from '../calendar/types';
import type { DateValue } from '../common/date-time/temporal';
import { pickerControlKey } from '../common/picker/control';
import { addPopupFocusTarget, usePickerPopup } from '../common/picker/popup';
import { injectDatePicker } from './root';
import type {
  DatePickerCalendarProps,
  DatePickerCalendarState,
  DatePickerRootValue,
} from './types';
import type { ElementSlotProps } from '../common/element';

defineOptions({ inheritAttrs: false });

defineProps<DatePickerCalendarProps>();
defineSlots<{
  default?(scope: { state: DatePickerCalendarState }): unknown;
  element?(scope: ElementSlotProps<DatePickerCalendarState>): unknown;
}>();

const picker = injectDatePicker('Calendar');
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
  onCancel() {},
});

function calendarProps() {
  const root = picker.props;
  return mergeProps(attrs, {
    modelValue: picker.value,
    defaultValue: picker.template,
    min: root.min,
    max: root.max,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: picker.calendar,
    disabled: picker.disabled,
    readonly: root.readonly,
    today: (attrs.today as DateValue | undefined) ?? picker.today ?? undefined,
    multiple: undefined,
    onValueChange: (value: DatePickerRootValue, details: CalendarRootChangeEventDetails) =>
      picker.commit(value, details),
  });
}

defineExpose({
  element: computed(() => calendar.value?.element ?? null),
  /** Gives the focus to `date`, else to the tab stop. */
  focus: (date?: DateValue) => calendar.value?.focus(date),
});
</script>

<template>
  <CalendarRoot v-if="$slots.element" :ref="setCalendar" v-bind="calendarProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </CalendarRoot>
  <CalendarRoot v-else :ref="setCalendar" v-bind="calendarProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </CalendarRoot>
</template>
