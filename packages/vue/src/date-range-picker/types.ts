import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { DateTimeFieldChangeEventReason } from '../common/date-time-field/field';
import type { DateMatcher } from '../common/date-time/matchers';
import type { DateValue } from '../common/date-time/temporal';
import type { OwnedKeys } from '../common/picker/field';
import type { DateFieldRootProps, DateFieldRootState } from '../date-field/types';
import type {
  PopoverPopupProps,
  PopoverPopupState,
  PopoverPositionerProps,
  PopoverPositionerState,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverTriggerProps,
  PopoverTriggerState,
} from '../popover/types';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootProps,
  RangeCalendarRootState,
} from '../range-calendar/types';

/** The first day and the last day of a range. An end is `null` while it has no value. */
export type DateRangePickerRootValue<Value extends DateValue = DateValue> = readonly [
  start: Value | null,
  end: Value | null,
];

export type DateRangePickerRootGranularity = 'day' | 'hour' | 'minute' | 'second';

export type DateRangePickerRootChangeEventReason =
  'day-press' | 'drag' | 'keyboard' | DateTimeFieldChangeEventReason;

export type DateRangePickerRootChangeEventDetails =
  ChangeEventDetails<DateRangePickerRootChangeEventReason>;

export type DateRangePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;

export type DateRangePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export interface DateRangePickerRootState {}

export interface DateRangePickerRootProps<Value extends DateValue = DateValue> {
  /**
   * The first day and the last day of the range: each a `Temporal.PlainDate`, `PlainDateTime` or
   * `ZonedDateTime`, or `null` while it has no value. `null` is `[null, null]`. A new end has the
   * kind, the calendar, the time and the zone of an end.
   */
  modelValue?: DateRangePickerRootValue<Value> | null | undefined;
  /** The first range of a picker with no `modelValue`. */
  defaultValue?: DateRangePickerRootValue<Value> | null | undefined;
  /** The popup is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The popup is open at the mount of an uncontrolled picker.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * The modal state of the open popup, as for `Popover.Root`.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * The press that gives the second end, or a drag, closes the popup. The user sets a time in a
   * field, so the default is `true` also for a range with a time.
   * @default true
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The last unit that the fields show. With no value, it also gives the kind of a new end: `day` a
   * date, and a time unit a date with a time.
   */
  granularity?: DateRangePickerRootGranularity | undefined;
  /**
   * Gives the kind, the calendar, the time zone and the hidden units of a first end, and the
   * numbers of an empty segment for an arrow key.
   */
  referenceDate?: DateValue | undefined;
  /** The hour cycle. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24 | undefined;
  /**
   * The day, the month and the hour show a leading zero.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * The fields show no time zone name for a `Temporal.ZonedDateTime`.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest end. The calendar disables an earlier day, and an earlier end makes its field
   * invalid. An end before the first end makes the end field invalid.
   */
  min?: DateValue | undefined;
  /** The latest end. The calendar disables a later day, and a later end makes its field invalid. */
  max?: DateValue | undefined;
  /** The dates that the picker refuses: a date, a range, a day of the week, a function or a list. */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The locale of each text. The default is the locale of the nearest `LocaleProvider`, else
   * `en-US`.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar that the fields and the calendar show, such as `gregory` or `persian`. The
   * default is the calendar of an end that is not ISO, else the calendar of the locale.
   */
  calendar?: string | undefined;
  /**
   * The time zone in which the picker reads today. The default is the zone of a
   * `Temporal.ZonedDateTime` end, else the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * The user cannot change the range or open the popup.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The user cannot change the range or open the popup. The fields stay in the tab order and in
   * the form data.
   * @default false
   */
  readonly?: boolean | undefined;
  /**
   * The user must give both ends before a submit.
   * @default false
   */
  required?: boolean | undefined;
  /** The name of the form input of the start field. */
  startName?: string | undefined;
  /** The name of the form input of the end field. */
  endName?: string | undefined;
  /** The `id` of the form of the form inputs, for a picker outside that form. */
  form?: string | undefined;
}

type FieldOwned = OwnedKeys<
  DateFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'min'
  | 'max'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'timeZone'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'name'
  | 'form'
>;

export interface DateRangePickerStartFieldProps extends /* @vue-ignore */ Omit<
  DateFieldRootProps,
  FieldOwned
> {}

export interface DateRangePickerStartFieldState extends DateFieldRootState {}

export interface DateRangePickerEndFieldProps extends /* @vue-ignore */ Omit<
  DateFieldRootProps,
  FieldOwned
> {}

export interface DateRangePickerEndFieldState extends DateFieldRootState {}

type TriggerOwned = OwnedKeys<
  PopoverTriggerProps,
  'disabled' | 'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
>;

export interface DateRangePickerTriggerProps extends /* @vue-ignore */ Omit<
  PopoverTriggerProps,
  TriggerOwned
> {
  /**
   * The user cannot press the trigger. A disabled or read-only picker also disables it.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface DateRangePickerTriggerState extends PopoverTriggerState {}

export interface DateRangePickerPositionerProps extends /* @vue-ignore */ Omit<
  PopoverPositionerProps,
  OwnedKeys<PopoverPositionerProps, 'anchor' | 'align'>
> {
  /**
   * The anchor of the popup. The default is the box around the first start field and the first end
   * field, else the one field, else the trigger.
   */
  anchor?: PopoverPositionerProps['anchor'] | undefined;
  /**
   * The alignment of the popup on the side of the anchor.
   * @default 'start'
   */
  align?: PopoverPositionerProps['align'] | undefined;
}

export interface DateRangePickerPositionerState extends PopoverPositionerState {}

export interface DateRangePickerPopupProps extends /* @vue-ignore */ Omit<
  PopoverPopupProps,
  OwnedKeys<PopoverPopupProps, 'initialFocus'>
> {
  /**
   * The element that gets the focus at the open. The default is the day of the tab stop of the
   * calendar, else the default of `Popover.Popup`. `true`, `null` and a function that gives one of
   * them ask for that default.
   */
  initialFocus?: PopoverPopupProps['initialFocus'] | undefined;
}

export interface DateRangePickerPopupState extends PopoverPopupState {}

/** The events of `RangeCalendar.Root` that reach it from the part. */
interface CalendarListeners {
  onMonthChange?:
    | ((month: Temporal.PlainYearMonth, details: RangeCalendarRootChangeEventDetails) => void)
    | undefined;
  'onUpdate:month'?: ((month: Temporal.PlainYearMonth) => void) | undefined;
  onFocusedDateChange?:
    ((date: Temporal.PlainDate, details: RangeCalendarRootChangeEventDetails) => void) | undefined;
  'onUpdate:focusedDate'?: ((date: Temporal.PlainDate) => void) | undefined;
}

type CalendarOwned = OwnedKeys<
  RangeCalendarRootProps<DateValue>,
  | 'modelValue'
  | 'defaultValue'
  | 'min'
  | 'max'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'disabled'
  | 'readonly'
>;

/** The props of `RangeCalendar.Root` that the picker does not own, and the events that reach it. */
type CalendarProps = Omit<RangeCalendarRootProps<DateValue>, CalendarOwned> & CalendarListeners;

export interface DateRangePickerCalendarProps extends /* @vue-ignore */ CalendarProps {}

export interface DateRangePickerCalendarState extends RangeCalendarRootState {}
