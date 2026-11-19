<script lang="ts">
import type {
  CalendarRootChangeEventDetails,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
} from '../../calendar/root/CalendarRoot.vue';

export interface DatePickerCalendarState extends CalendarRootState {}

/**
 * The props of `Calendar.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar, the time zone and the states `disabled` and
 * `readOnly`. The calendar takes the focus when the popup opens, so it has no `autoFocus`.
 */
export interface DatePickerCalendarProps extends Omit<
  CalendarRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'multiple'
  | 'minDays'
  | 'maxDays'
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
import { computed, useTemplateRef } from 'vue';
import CalendarRoot from '../../calendar/root/CalendarRoot.vue';
import {
  PickerCalendarOwner,
  providePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import type { DateValue } from '../../internals/date-time/temporal';
import { givenAttributes } from '../../internals/givenAttributes';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';

defineOptions({ inheritAttrs: false });

// `Calendar.Root` reads an absent `showOutsideDays` as the default of its broadcast calendar. Vue
// changes an absent Boolean prop to `false`, so the prop has the default `undefined`.
const props = withDefaults(defineProps<DatePickerCalendarProps>(), {
  as: 'div',
  showOutsideDays: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DatePicker.Calendar');
}

const emit = defineEmits<{
  /**
   * Callback fired when the month that the grid shows changes.
   */
  monthChange: [month: Temporal.PlainYearMonth, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `monthChange` with the new month, unless a listener cancels the
   * change. `v-model:month` uses it.
   */
  'update:month': [month: Temporal.PlainYearMonth];
  /**
   * Callback fired when the day that has the tab stop changes.
   */
  focusedDateChange: [date: Temporal.PlainDate, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `focusedDateChange` with the new day, unless a listener cancels the
   * change. `v-model:focusedDate` uses it.
   */
  'update:focusedDate': [date: Temporal.PlainDate];
  /**
   * Callback fired when the grid shows another view.
   */
  viewChange: [view: CalendarRootView, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `viewChange` with the new view, unless a listener cancels the
   * change. `v-model:view` uses it.
   */
  'update:view': [view: CalendarRootView];
}>();

defineSlots<{
  default(props: { state: DatePickerCalendarState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerCalendarState>;
}>();

const picker = useDatePickerRootContext();
const popup = usePickerPopup();

const calendar = useTemplateRef<{
  element: HTMLElement | null;
  focus: (date?: DateValue) => void;
}>('calendar');
const element = computed(() => calendar.value?.element ?? null);

providePickerControl(PickerCalendarOwner, (event) => {
  if (picker.closeOnSelect.value && popup.open.value) {
    popup.closeAfterSelection(event);
  }
});

const calendarHandlers = {
  onMonthChange: (month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails) => {
    emit('monthChange', month, details);
  },
  'onUpdate:month': (month: Temporal.PlainYearMonth) => {
    emit('update:month', month);
  },
  onFocusedDateChange: (date: Temporal.PlainDate, details: CalendarRootChangeEventDetails) => {
    emit('focusedDateChange', date, details);
  },
  'onUpdate:focusedDate': (date: Temporal.PlainDate) => {
    emit('update:focusedDate', date);
  },
  onViewChange: (view: CalendarRootView, details: CalendarRootChangeEventDetails) => {
    emit('viewChange', view, details);
  },
  'onUpdate:view': (view: CalendarRootView) => {
    emit('update:view', view);
  },
};

// `Calendar.Root` has a type parameter for the kind of its value, and vue-tsc takes it from the
// props. The picker has any kind, so the value and the default value have the type `any`. The
// default value gives the kind of a new value, the same kind as for the field.
function calendarProps(attributes: Record<string, unknown>) {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    modelValue: picker.value.value,
    defaultValue: picker.template.value,
  };
  return {
    ...mergeProps(calendarHandlers, givenAttributes(attributes)),
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
  <CalendarRoot
    v-if="$slots.render"
    ref="calendar"
    v-bind="calendarProps(withoutPropsOf($attrs, CalendarRoot))"
    @value-change="picker.commit"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </CalendarRoot>
  <CalendarRoot
    v-else
    ref="calendar"
    v-bind="calendarProps(withoutPropsOf($attrs, CalendarRoot))"
    @value-change="picker.commit"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </CalendarRoot>
</template>
