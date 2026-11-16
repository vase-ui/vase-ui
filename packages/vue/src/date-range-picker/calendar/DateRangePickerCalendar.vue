<script lang="ts">
import type {
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
  | 'value'
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
import { computed, useAttrs, useTemplateRef } from 'vue';
import type { DateValue } from '../../internals/date-time/temporal';
import { useFocusOnOpen, usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { omitUndefinedAttributes } from '../../internals/omitUndefinedAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
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

defineSlots<{
  default(props: { state: DateRangePickerCalendarState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerCalendarState>;
}>();

const attrs = useAttrs();
const picker = useDateRangePickerRootContext();
const popup = usePickerPopup();

// This part renders `RangeCalendar.Root` and makes no element of its own. The template has one form
// for `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `RangeCalendar.Root` dynamic. Vue then renders `RangeCalendar.Root` again each time this part
// renders.
const calendar = useTemplateRef<{
  element: HTMLElement | null;
  focus: (date?: DateValue) => void;
}>('calendar');
const element = computed(() => calendar.value?.element ?? null);

// The popup puts the focus on the first tabbable element, which is a navigation button. The day
// that has the tab stop is the element that the date picker pattern names.
useFocusOnOpen(popup, () => calendar.value?.focus());

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

// `RangeCalendar.Root` has a type parameter for the kind of its ends, and vue-tsc takes it from the
// props. The picker has any kind, so the value and the default value have the type `any`. The
// default value gives the kind of a new end, the same kind as for the fields.
function calendarProps() {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    value: picker.range.value,
    defaultValue: [picker.template.value, picker.template.value],
  };
  return {
    ...omitUndefinedAttributes(attrs),
    ...props,
    ...valueProps,
    minDate: root.minDate,
    maxDate: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: picker.disabled.value,
    readOnly: root.readOnly,
  };
}

defineExpose({
  element,
  /** Gives the focus to `date`, or to the day that has the tab stop. */
  focus: (date?: DateValue) => {
    calendar.value?.focus(date);
  },
});
</script>

<template>
  <RangeCalendarRoot
    v-if="$slots.render"
    ref="calendar"
    v-bind="calendarProps()"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </RangeCalendarRoot>
  <RangeCalendarRoot
    v-else
    ref="calendar"
    v-bind="calendarProps()"
    @value-change="handleValueChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </RangeCalendarRoot>
</template>
