<script lang="ts">
import type { CalendarChangeEventReason } from '../../internals/date-time/calendar/calendarProps';
import type {
  DateTimeFieldChangeEventReason,
  DateTimeFieldGranularity,
} from '../../common/date-time-field/field';
import type { DateMatcher } from '../../internals/date-time/matchers';
import type { DateValue } from '../../internals/date-time/temporal';
import type { ChangeEventDetails } from '../../common/changeEventDetails';
import type {
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
} from '../../popover/types';

export interface DatePickerRootState {}

/** The kinds of value that the picker takes and gives back. */
export type DatePickerRootValue = DateValue | Temporal.PlainYearMonth;

export type DatePickerRootGranularity = DateTimeFieldGranularity;

// `none` is the reason of a native reset of the form, and of `clear()` of a field part.
export type DatePickerRootChangeEventReason =
  CalendarChangeEventReason | DateTimeFieldChangeEventReason | 'none';
export type DatePickerRootChangeEventDetails = ChangeEventDetails<DatePickerRootChangeEventReason>;

export type DatePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;
export type DatePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export interface DatePickerRootActions {
  /** Closes the popup. */
  close(): void;
}

export interface DatePickerRootProps<
  Value extends DatePickerRootValue = DatePickerRootValue,
> extends Omit<PopoverRootProps, 'handle' | 'triggerId' | 'defaultTriggerId'> {
  /**
   * The value of the picker: a `Temporal.PlainDate`, a `Temporal.PlainDateTime`, a
   * `Temporal.ZonedDateTime` or a `Temporal.PlainYearMonth`. The value that the picker gives has
   * the kind, the calendar, the time and the time zone of the value that it got. The value is
   * `null` while the picker has none.
   *
   * To render an uncontrolled picker, use the `defaultValue` prop instead.
   */
  modelValue?: Value | null | undefined;
  /**
   * The uncontrolled value of the picker when it is initially rendered.
   *
   * To render a controlled picker, use the `modelValue` prop instead.
   */
  defaultValue?: Value | null | undefined;
  /**
   * Whether a selection in the calendar closes the popup. The default is `true` for a value with no
   * time. It is `false` for a value with a time, because the user then sets the time.
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The last unit that the field shows. A date takes `day` or `month`, and shows `day` with no
   * prop. A year and month always shows `month`. A date with a time takes each unit, and shows
   * `minute` with no prop. With no value, the prop also gives the kind of the value that the
   * picker makes: `day` gives a date, `month` gives a year and month, and each other unit gives a
   * date with a time.
   */
  granularity?: DatePickerRootGranularity | undefined;
  /**
   * The date that gives the numbers of an empty segment, and the kind and the time zone of the
   * value that the picker makes. With no reference date, the numbers come from today at midnight.
   */
  referenceDate?: DatePickerRootValue | undefined;
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
   * Whether the field hides the name of the time zone of a `Temporal.ZonedDateTime` value.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest date that the picker accepts. The calendar disables an earlier day, and an earlier
   * date in the field makes the picker invalid. A limit with a time also limits the time of a field
   * that shows a time. A zoned limit limits a zoned value by the moment.
   */
  minDate?: DateValue | undefined;
  /**
   * The latest date that the picker accepts. The calendar disables a later day, and a later date in
   * the field makes the picker invalid. A limit with a time also limits the time of a field that
   * shows a time. A zoned limit limits a zoned value by the moment.
   */
  maxDate?: DateValue | undefined;
  /**
   * The dates that the picker refuses. The calendar shows each such day with no selection, and such
   * a date in the field makes the picker invalid. The matcher is a date, a range of dates, a day of
   * the week, a function or a list of these.
   */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The locale that `Intl` uses for the layout, the names and the digits of the field, and for the
   * calendar. Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar in which the field and the calendar show a date, such as `gregory` or `persian`.
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
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the picker when a form is submitted.
   */
  name?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value extends DatePickerRootValue = DatePickerRootValue">
import { computed, provide, useTemplateRef } from 'vue';
import { useDateTimePickerRoot } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { assertTemporal } from '../../internals/date-time/temporal';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverRoot from '../../popover/PopoverRoot.vue';
import { DatePickerRootContext } from './DatePickerRootContext';
import { createPickerTemplate, hasTime } from './pickerTemplate';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerRootProps<Value>>(), {
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
  useCastBooleanWarning('DatePicker.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the value changes. The value is `null` while a segment of the field
   * is empty.
   *
   * The `eventDetails.reason` says what caused the change:
   * - `'day-press'` and `'month-press'` for a press in the calendar
   * - `'input-change'` for typing or autofill in the field
   * - `'input-clear'` when the user removes a digit with the text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keys that change a segment
   * - `'clear-press'` when the user presses a clear button
   * - `'none'` for a native reset of the form or a call of `clear()` of the field
   */
  valueChange: [value: Value | null, eventDetails: DatePickerRootChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value | null];
  /**
   * Event handler called when the popup is opened or closed.
   *
   * The `eventDetails.reason` is `'trigger-press'` for the trigger, and for Alt+Down in the field.
   * It is `'imperative-action'` for a close after a selection.
   */
  openChange: [open: boolean, eventDetails: DatePickerRootOpenChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the picker, such as `DatePicker.Field`.
   */
  default(): unknown;
}>();

assertTemporal('DatePicker.Root');

const fallback = computed(
  () =>
    props.referenceDate ?? createPickerTemplate(props.granularity, props.calendar, props.timeZone),
);

const picker = useDateTimePickerRoot<DatePickerRootValue, DatePickerRootChangeEventDetails>({
  part: 'DatePicker',
  value: () => props.modelValue,
  defaultValue: () => props.defaultValue,
  fallback,
  closeOnSelect: () => props.closeOnSelect,
  disabled: () => props.disabled,
  hasTime,
  valueChange: (value, details) => emit('valueChange', value as Value | null, details),
  updateValue: (value) => emit('update:modelValue', value as Value | null),
});

provide(DatePickerRootContext, { ...picker, props });

const popover = useTemplateRef<DatePickerRootActions>('popover');

defineExpose<DatePickerRootActions>({
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
  >
    <slot />
  </PopoverRoot>
</template>
