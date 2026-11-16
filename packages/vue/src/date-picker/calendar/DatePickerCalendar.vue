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
  | 'value'
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
import { isElement } from '@floating-ui/utils/dom';
import { computed, useAttrs, useTemplateRef } from 'vue';
import CalendarRoot from '../../calendar/root/CalendarRoot.vue';
import { closest, getTarget } from '../../common/shadowDom';
import {
  getCalendarTabStop,
  usePickerFocusTarget,
  usePickerPopup,
} from '../../internals/date-time/picker/usePickerPopup';
import { isKind } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import { omitUndefinedAttributes } from '../../internals/omitUndefinedAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootValue,
} from '../root/DatePickerRoot.vue';

defineOptions({ inheritAttrs: false });

// `Calendar.Root` reads an absent `showOutsideDays` as the default of its broadcast calendar. Vue
// changes an absent Boolean prop to `false`, so the prop has the default `undefined`.
const props = withDefaults(defineProps<DatePickerCalendarProps>(), {
  as: 'div',
  showOutsideDays: undefined,
});

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

const attrs = useAttrs();
const picker = useDatePickerRootContext();
const popup = usePickerPopup();

// This part renders `Calendar.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `Calendar.Root` dynamic. Vue then renders `Calendar.Root` again each time this part renders.
const calendar = useTemplateRef<{
  element: HTMLElement | null;
  focus: (date?: DateValue) => void;
}>('calendar');
const element = computed(() => calendar.value?.element ?? null);

// The focus manager of the popup puts the focus on the first tabbable element, which is a
// navigation button. The day that has the tab stop, or the month of a month picker, is the element
// that the date picker pattern names. The popup part gives it as its `initialFocus`.
usePickerFocusTarget(() => getCalendarTabStop(element.value));

function handleValueChange(
  value: DatePickerRootValue | null,
  details: DatePickerRootChangeEventDetails,
) {
  picker.commit(value, details);
  if (
    !details.isCanceled &&
    picker.closeOnSelect.value &&
    (details.reason === REASONS.dayPress || details.reason === REASONS.monthPress)
  ) {
    popup.closeAfterSelection(details.event);
  }
}

// A press on the selected day changes no value, so the calendar emits no change for it. The press
// still picks that day, and the popup closes as it does for a new day. The attributes of the cell
// say if the press picked the day: the grid of days selects for a date, and the grid of months for
// a year and month.
function handleClick(event: MouseEvent) {
  const root = event.currentTarget;
  const target = getTarget(event);
  if (
    !isElement(root) ||
    !isElement(target) ||
    !picker.closeOnSelect.value ||
    !popup.open.value ||
    picker.disabled.value ||
    picker.props.readOnly ||
    root.getAttribute('data-view') !==
      (isKind(picker.template.value, 'yearMonth') ? 'month' : 'day')
  ) {
    return;
  }
  const button = closest(target, 'button');
  const cell = closest(button, '[role="gridcell"]');
  if (
    cell?.getAttribute('aria-selected') === 'true' &&
    cell.getAttribute('aria-disabled') !== 'true' &&
    button?.getAttribute('aria-disabled') !== 'true'
  ) {
    popup.closeAfterSelection(event);
  }
}

const calendarHandlers = {
  onClick: handleClick,
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
function calendarProps() {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    value: picker.value.value,
    defaultValue: picker.template.value,
  };
  return {
    ...mergeProps(calendarHandlers, omitUndefinedAttributes(attrs)),
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
    v-bind="calendarProps()"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </CalendarRoot>
  <CalendarRoot v-else ref="calendar" v-bind="calendarProps()" @value-change="handleValueChange">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </CalendarRoot>
</template>
