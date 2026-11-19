<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type {
  RangeChangeEventReason,
  RangeValue,
} from '../../internals/date-time/calendar/rangeSelection';
import type { DateTimeFieldChangeEventReason } from '../../internals/date-time/field/DateTimeFieldContext';
import type { DateMatcher } from '../../internals/date-time/matchers';
import type { DateValue } from '../../internals/date-time/temporal';
import type {
  PopoverRootActions,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
} from '../../popover/root/PopoverRoot.vue';

export interface DateRangePickerRootState {}

/** The first day and the last day of a range. An end is `null` while it has no value. */
export type DateRangePickerRootValue<Value extends DateValue = DateValue> = RangeValue<Value>;

export type DateRangePickerRootGranularity = 'day' | 'hour' | 'minute' | 'second';

export type DateRangePickerRootChangeEventReason =
  RangeChangeEventReason | DateTimeFieldChangeEventReason;
export type DateRangePickerRootChangeEventDetails =
  VaseUIChangeEventDetails<DateRangePickerRootChangeEventReason>;

export type DateRangePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;
export type DateRangePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export type DateRangePickerRootActions = PopoverRootActions;

export interface DateRangePickerRootProps<Value extends DateValue = DateValue> extends Omit<
  PopoverRootProps,
  'handle' | 'triggerId' | 'defaultTriggerId'
> {
  /**
   * The first day and the last day of the range, each a `Temporal.PlainDate`, a
   * `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. An end is `null` while it has no value.
   * `null` is the same as `[null, null]`. The ends that the picker gives have the kind, the
   * calendar, the time and the time zone of the ends that it got.
   *
   * To render an uncontrolled picker, use the `defaultValue` prop instead.
   */
  modelValue?: readonly [Value | null, Value | null] | null | undefined;
  /**
   * The uncontrolled value of the picker when it is initially rendered.
   *
   * To render a controlled picker, use the `modelValue` prop instead.
   */
  defaultValue?: readonly [Value | null, Value | null] | null | undefined;
  /**
   * Whether the second press or a drag in the calendar closes the popup. The popup has no part for
   * a time, because the user sets a time in a field. The default is thus `true`, also for a range
   * with a time.
   * @default true
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The last unit that the fields show. With no prop, the fields show days. A unit of the time makes
   * them show a time too. With no value, the prop also gives the kind of the value that the picker
   * makes. `day` gives dates, and each other unit gives dates with a time.
   */
  granularity?: DateRangePickerRootGranularity | undefined;
  /**
   * The date that gives the numbers of an empty segment, and the kind and the time zone of the
   * value that the picker makes. With no reference date, the numbers come from today at midnight.
   */
  referenceDate?: DateValue | undefined;
  /**
   * The hour cycle of the time segments. With no prop, the hour cycle of the locale applies.
   */
  hourCycle?: 12 | 24 | undefined;
  /**
   * Whether the day, the month and the hour show a leading zero.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * Whether the fields hide the name of the time zone of a `Temporal.ZonedDateTime` value.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest date that the picker accepts. The calendar disables an earlier day, and an earlier
   * date in a field makes the picker invalid. A limit with a time also limits the time of a field
   * that shows a time. A zoned limit limits a zoned value by the moment.
   */
  minDate?: DateValue | undefined;
  /**
   * The latest date that the picker accepts. The calendar disables a later day, and a later date in
   * a field makes the picker invalid. A limit with a time also limits the time of a field that shows
   * a time. A zoned limit limits a zoned value by the moment.
   */
  maxDate?: DateValue | undefined;
  /**
   * The dates that the picker refuses. The calendar shows each such day with no selection, and such
   * a date in a field makes the picker invalid. The matcher is a date, a range of dates, a day of
   * the week, a function or a list of these.
   */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The locale that `Intl` uses for the layout, the names and the digits of the fields, and for the
   * calendar. Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar in which the fields and the calendar show a date, such as `gregory` or `persian`.
   * With no calendar, they use the calendar of the value when that calendar is not ISO. With
   * neither, they use the calendar of the locale. The value that the picker gives keeps its own
   * calendar.
   */
  calendar?: string | undefined;
  /**
   * The time zone in which the picker reads today. With no time zone, the picker uses the zone of a
   * `Temporal.ZonedDateTime` value, and then the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the value. The user cannot open the popup of a
   * read-only picker.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must enter both ends before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the first day of the range when a form is submitted.
   */
  startName?: string | undefined;
  /**
   * Identifies the last day of the range when a form is submitted.
   */
  endName?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden inputs are associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value extends DateValue = DateValue">
import { provide, useTemplateRef } from 'vue';
import {
  useDateTimePickerRoot,
  createPickerPartElements,
} from '../../internals/date-time/picker/useDateTimePickerRoot';
import { assertTemporal, today } from '../../internals/date-time/temporal';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverRoot from '../../popover/root/PopoverRoot.vue';
import { DateRangePickerRootContext } from './DateRangePickerRootContext';
import type { DateRangePickerRange } from './DateRangePickerRootContext';
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerRootProps<Value>>(), {
  open: undefined,
  defaultOpen: false,
  modal: false,
  modelValue: undefined,
  closeOnSelect: undefined,
  forceLeadingZeros: false,
  hideTimeZone: false,
  disabled: false,
  readOnly: false,
  required: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DateRangePicker.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the value changes. An end is `null` while it has no value.
   *
   * The `eventDetails.reason` says what caused the change:
   * - `'day-press'` for a press on a day in the calendar, and `'drag'` for a drag over the days
   * - `'keyboard'` for a key in the calendar or in a segment
   * - `'input-change'` for typing or autofill in a field
   * - `'input-clear'` when the user removes a digit with the text input
   * - `'input-paste'` for paste interactions
   * - `'clear-press'` when the user presses a clear button
   * - `'none'` for a native reset of the form or a call of `clear()` of a field
   */
  valueChange: [
    value: DateRangePickerRootValue<Value>,
    eventDetails: DateRangePickerRootChangeEventDetails,
  ];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: DateRangePickerRootValue<Value>];
  /**
   * Event handler called when the popup is opened or closed.
   *
   * The `eventDetails.reason` is `'trigger-press'` for the trigger, and for Alt+Down in a field.
   * It is `'imperative-action'` for a close after the second press or a drag in the calendar.
   */
  openChange: [open: boolean, eventDetails: DateRangePickerRootOpenChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the picker, such as `DateRangePicker.StartField`.
   */
  default(): unknown;
}>();

assertTemporal('DateRangePicker.Root');

const EMPTY_RANGE: DateRangePickerRange = [null, null];

const picker = useDateTimePickerRoot<
  DateRangePickerRange,
  DateValue,
  DateRangePickerRootChangeEventDetails
>(props, {
  name: 'DateRangePicker',
  empty: EMPTY_RANGE,
  templateOf: ([start, end]) => start ?? end,
  fallback() {
    if (props.referenceDate) {
      return props.referenceDate;
    }
    const date = today(props.timeZone);
    return props.granularity === undefined || props.granularity === 'day'
      ? date
      : date.toPlainDateTime();
  },
  valueChange: (range, details) =>
    emit('valueChange', range as DateRangePickerRootValue<Value>, details),
  updateValue: (range) => emit('update:modelValue', range as DateRangePickerRootValue<Value>),
});

provide(DateRangePickerRootContext, { ...picker, endFields: createPickerPartElements(), props });

const popover = useTemplateRef<DateRangePickerRootActions>('popover');

defineExpose<DateRangePickerRootActions>({
  unmount: () => popover.value?.unmount(),
  close: () => popover.value?.close(),
});
</script>

<template>
  <PopoverRoot
    ref="popover"
    v-bind="withoutPropsOf($attrs, PopoverRoot)"
    :open="props.open"
    :default-open="props.defaultOpen"
    :modal="props.modal"
    @open-change="(open, details) => emit('openChange', open, details)"
    @update:open="(open) => emit('update:open', open)"
    @open-change-complete="(open) => emit('openChangeComplete', open)"
  >
    <slot />
  </PopoverRoot>
</template>
