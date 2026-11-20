<script lang="ts">
import type {
  CalendarRootChangeEventDetails,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
} from '../../calendar/types';
import type { VaseUIComponentProps } from '../../internals/types';

export interface DatePickerCalendarState extends CalendarRootState {}

/**
 * The props of `Calendar.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar and the states `disabled` and `readonly`. The
 * calendar takes the focus when the popup opens, so it has no `autofocus`.
 */
export interface DatePickerCalendarProps
  extends
    Omit<
      CalendarRootProps,
      | 'as'
      | 'modelValue'
      | 'defaultValue'
      | 'multiple'
      | 'minDays'
      | 'maxDays'
      | 'min'
      | 'max'
      | 'unavailableDates'
      | 'locale'
      | 'calendar'
      | 'disabled'
      | 'readonly'
      | 'autofocus'
    >,
    Pick<VaseUIComponentProps<DatePickerCalendarState>, 'as'> {}
</script>

<script setup lang="ts">
import { computed, useSlots, useTemplateRef } from 'vue';
import CalendarRoot from '../../calendar/CalendarRoot.vue';
import {
  PickerCalendarOwner,
  providePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { warnWithoutCalendarElement } from '../../internals/date-time/picker/warnWithoutCalendarElement';
import { isKind } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import { createChangeEventDetails as createPickerEventDetails } from '../../internals/createVaseUIEventDetails';
import { givenAttributes } from '../../internals/givenAttributes';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
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

const slots = useSlots();
const picker = useDatePickerRootContext();
const popup = usePickerPopup();

// The popup is not in the server HTML, so the calendar reads the clock in its setup and has its page
// and its tab stop in its first render. The bridge goes when the pickers move to the new calendar.
const template = picker.template.value;
const clockToday = Temporal.Now.plainDateISO(
  picker.props.timeZone ?? (isKind(template, 'zonedDateTime') ? template.timeZoneId : undefined),
);

// This part renders `Calendar.Root` with `as`, or with `#render` in the `element` slot of the root.
// A `v-if` on a slot template makes the slots of the root dynamic, so the template has two roots.
const calendar = useTemplateRef<{
  element: HTMLElement | null;
  focus: (date?: DateValue) => void;
}>('calendar');
const element = computed(() => calendar.value?.element ?? null);
warnWithoutCalendarElement(
  () => element.value,
  () => !!slots.render,
);

providePickerControl(PickerCalendarOwner, (event) => {
  if (picker.closeOnSelect.value && popup.open.value) {
    popup.closeAfterSelection(event);
  }
});

// The listeners of the picker get the details of its own API.
function handleValueChange(
  value: DatePickerRootValue | null,
  details: CalendarRootChangeEventDetails,
) {
  const pickerDetails = createPickerEventDetails(
    details.reason,
    details.event,
  ) as DatePickerRootChangeEventDetails;
  picker.commit(value, pickerDetails);
  if (pickerDetails.isCanceled) details.cancel();
}

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
function calendarProps(attributes: Record<string, unknown>): Record<string, unknown> {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    modelValue: picker.value.value,
    defaultValue: picker.template.value,
  };
  const { as: _as, ...own } = props;
  return {
    ...mergeProps(calendarHandlers, givenAttributes(attributes)),
    ...own,
    ...valueProps,
    today: props.today ?? clockToday,
    min: root.minDate,
    max: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    disabled: picker.disabled.value,
    readonly: root.readOnly,
  };
}

// An older part takes a component with a type parameter in `as`, and `Calendar.Root` renders it.
const rootAs = () => props.as as CalendarRootProps['as'];

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
    @value-change="handleValueChange"
  >
    <template #element="{ props: elementProps, elementRef, state }">
      <slot name="render" :props="{ ...elementProps, ref: elementRef }" :state="state" />
    </template>
  </CalendarRoot>
  <CalendarRoot
    v-else
    ref="calendar"
    v-bind="calendarProps(withoutPropsOf($attrs, CalendarRoot))"
    :as="rootAs()"
    @value-change="handleValueChange"
  >
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </CalendarRoot>
</template>
