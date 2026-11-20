<script lang="ts">
import type { VaseUIComponentProps } from '../../internals/types';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootProps,
  RangeCalendarRootState,
} from '../../range-calendar/types';

export interface DateRangePickerCalendarState extends RangeCalendarRootState {}

/**
 * The props of `RangeCalendar.Root` that the picker does not own. The root of the picker owns the
 * range, the limits, the locale, the calendar and the states `disabled` and `readonly`. The
 * calendar takes the focus when the popup opens, so it has no `autofocus`.
 */
export interface DateRangePickerCalendarProps
  extends
    Omit<
      RangeCalendarRootProps,
      | 'as'
      | 'modelValue'
      | 'defaultValue'
      | 'min'
      | 'max'
      | 'unavailableDates'
      | 'locale'
      | 'calendar'
      | 'disabled'
      | 'readonly'
      | 'autofocus'
    >,
    Pick<VaseUIComponentProps<DateRangePickerCalendarState>, 'as'> {}
</script>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue';
import { isKind } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import {
  PickerCalendarOwner,
  providePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { createChangeEventDetails as createPickerEventDetails } from '../../internals/createVaseUIEventDetails';
import { givenAttributes } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import { rangeCalendarHostKey } from '../../range-calendar/host';
import RangeCalendarRoot from '../../range-calendar/RangeCalendarRoot.vue';
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

// The popup is not in the server HTML, so the calendar reads the clock in its setup and has its page
// and its tab stop in its first render. The bridge goes when the pickers move to the new calendar.
const template = picker.template.value;
const clockToday = Temporal.Now.plainDateISO(
  picker.props.timeZone ?? (isKind(template, 'zonedDateTime') ? template.timeZoneId : undefined),
);

// This part renders `RangeCalendar.Root`, and the `element` slot of the root renders `as` or
// `#render`.
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
  calendarDetails: RangeCalendarRootChangeEventDetails,
) {
  // The listeners of the picker get the details of its own API.
  const details = createPickerEventDetails(
    calendarDetails.reason,
    calendarDetails.event,
  ) as DateRangePickerRootChangeEventDetails;
  picker.commit(range, details);
  if (details.isCanceled) calendarDetails.cancel();
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
provide(rangeCalendarHostKey, {
  onSameRange(event) {
    if (picker.closeOnSelect.value) {
      popup.closeAfterSelection(event);
    }
  },
});

const calendarHandlers = {
  onMonthChange: (month: Temporal.PlainYearMonth, details: RangeCalendarRootChangeEventDetails) => {
    emit('monthChange', month, details);
  },
  'onUpdate:month': (month: Temporal.PlainYearMonth) => {
    emit('update:month', month);
  },
  onFocusedDateChange: (date: Temporal.PlainDate, details: RangeCalendarRootChangeEventDetails) => {
    emit('focusedDateChange', date, details);
  },
  'onUpdate:focusedDate': (date: Temporal.PlainDate) => {
    emit('update:focusedDate', date);
  },
};

// `RangeCalendar.Root` has a type parameter for the kind of its ends, and vue-tsc takes it from the
// props. The picker has any kind, so the value and the default value have the type `any`. The
// default value gives the kind of a new end, the same kind as for the fields.
function calendarProps(attributes: Record<string, unknown>) {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    modelValue: picker.range.value,
    defaultValue: [picker.template.value, picker.template.value],
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
    ref="calendar"
    v-bind="calendarProps(withoutPropsOf($attrs, RangeCalendarRoot))"
    @value-change="handleValueChange"
  >
    <template #element="{ props: elementProps, elementRef, state }">
      <slot
        v-if="$slots.render"
        name="render"
        :props="{ ...elementProps, ref: elementRef }"
        :state="state"
      />
      <component :is="as" v-else v-bind="elementProps" :ref="elementRef">
        <slot :state="state" />
      </component>
    </template>
  </RangeCalendarRoot>
</template>
