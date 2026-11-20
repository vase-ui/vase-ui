import type {
  CalendarRootChangeEventDetails,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
} from '../calendar/types';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type {
  DateTimeFieldChangeEventReason,
  DateTimeFieldGranularity,
} from '../common/date-time-field/field';
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
import type { TimeFieldRootProps, TimeFieldRootState } from '../time-field/types';

/** The kinds of value that the picker takes and gives back. */
export type DatePickerRootValue = DateValue | Temporal.PlainYearMonth;

export type DatePickerRootGranularity = DateTimeFieldGranularity;

export type DatePickerRootChangeEventReason =
  'day-press' | 'month-press' | DateTimeFieldChangeEventReason;

export type DatePickerRootChangeEventDetails = ChangeEventDetails<DatePickerRootChangeEventReason>;

export type DatePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;

export type DatePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export interface DatePickerRootState {}

export interface DatePickerRootProps<Value extends DatePickerRootValue = DatePickerRootValue> {
  /**
   * The value: a `Temporal.PlainDate`, `PlainDateTime`, `ZonedDateTime` or `PlainYearMonth`, or
   * `null` for no value. A new value has the kind, the calendar, the time and the zone of the value,
   * else of `defaultValue`, else of the last value.
   */
  modelValue?: Value | null | undefined;
  /** The first value of a picker with no `modelValue`. */
  defaultValue?: Value | null | undefined;
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
   * A pick in the calendar closes the popup. The default is `true` for a value with no time, and
   * `false` for a value with a time, so that the user can set the time.
   * In a wrapper that declares this prop, give it the default `undefined`.
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The last unit that the field shows. With no value, it also gives the kind of a new value:
   * `month` a year and month, `day` a date, and a time unit a date with a time.
   */
  granularity?: DatePickerRootGranularity | undefined;
  /**
   * Gives the kind, the calendar, the time zone and the hidden units of a first value, and the
   * numbers of an empty segment for an arrow key.
   */
  referenceDate?: DatePickerRootValue | undefined;
  /** The hour cycle. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24 | undefined;
  /**
   * The day, the month and the hour show a leading zero.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * The field shows no time zone name for a `Temporal.ZonedDateTime`.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest value. The calendar disables an earlier day, and an earlier value makes the field
   * invalid. A limit with a time also limits the time of a field that shows a time.
   */
  min?: DateValue | undefined;
  /**
   * The latest value. The calendar disables a later day, and a later value makes the field
   * invalid. A limit with a time also limits the time of a field that shows a time.
   */
  max?: DateValue | undefined;
  /** The dates that the picker refuses: a date, a range, a day of the week, a function or a list. */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The locale of each text. The default is the locale of the nearest `LocaleProvider`, else
   * `en-US`.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar that the field and the calendar show, such as `gregory` or `persian`. The default
   * is the calendar of a value that is not ISO, else the calendar of the locale. A value keeps its
   * own calendar.
   */
  calendar?: string | undefined;
  /**
   * The time zone in which the picker reads today. The default is the zone of a
   * `Temporal.ZonedDateTime` value, else the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * The user cannot change the value or open the popup.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The user cannot change the value or open the popup. The field stays in the tab order and in the
   * form data.
   * @default false
   */
  readonly?: boolean | undefined;
  /**
   * The user must give a value before a submit.
   * @default false
   */
  required?: boolean | undefined;
  /** The name of the form input. The name of a `Field` wins. */
  name?: string | undefined;
  /** The `id` of the form of the form input, for a picker outside that form. */
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

export interface DatePickerFieldProps extends /* @vue-ignore */ Omit<
  DateFieldRootProps,
  FieldOwned
> {}

export interface DatePickerFieldState extends DateFieldRootState {}

type TimeFieldOwned = OwnedKeys<
  TimeFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'locale'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'name'
  | 'form'
  | 'autocomplete'
>;

export interface DatePickerTimeFieldProps extends /* @vue-ignore */ Omit<
  TimeFieldRootProps,
  TimeFieldOwned
> {}

export interface DatePickerTimeFieldState extends TimeFieldRootState {}

type TriggerOwned = OwnedKeys<
  PopoverTriggerProps,
  'disabled' | 'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
>;

export interface DatePickerTriggerProps extends /* @vue-ignore */ Omit<
  PopoverTriggerProps,
  TriggerOwned
> {
  /**
   * The user cannot press the trigger. A disabled or read-only picker also disables it.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface DatePickerTriggerState extends PopoverTriggerState {}

export interface DatePickerPositionerProps extends /* @vue-ignore */ Omit<
  PopoverPositionerProps,
  OwnedKeys<PopoverPositionerProps, 'anchor' | 'align'>
> {
  /** The anchor of the popup. The default is the first field of the picker, else the trigger. */
  anchor?: PopoverPositionerProps['anchor'] | undefined;
  /**
   * The alignment of the popup on the side of the anchor.
   * @default 'start'
   */
  align?: PopoverPositionerProps['align'] | undefined;
}

export interface DatePickerPositionerState extends PopoverPositionerState {}

export interface DatePickerPopupProps extends /* @vue-ignore */ Omit<
  PopoverPopupProps,
  OwnedKeys<PopoverPopupProps, 'initialFocus'>
> {
  /**
   * The element that gets the focus at the open. The default is the day or the month of the tab
   * stop of the calendar, else the default of `Popover.Popup`. `true`, `null` and a function that
   * gives one of them ask for that default. `false` moves no focus.
   */
  initialFocus?: PopoverPopupProps['initialFocus'] | undefined;
}

export interface DatePickerPopupState extends PopoverPopupState {}

type CalendarOwned = OwnedKeys<
  CalendarRootProps<DatePickerRootValue>,
  | 'modelValue'
  | 'defaultValue'
  | 'min'
  | 'max'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'disabled'
  | 'readonly'
  | 'multiple'
  | 'minDays'
  | 'maxDays'
>;

/** The events of `Calendar.Root` that reach it from the part. */
interface CalendarListeners {
  onMonthChange?:
    ((month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails) => void) | undefined;
  'onUpdate:month'?: ((month: Temporal.PlainYearMonth) => void) | undefined;
  onFocusedDateChange?:
    ((date: Temporal.PlainDate, details: CalendarRootChangeEventDetails) => void) | undefined;
  'onUpdate:focusedDate'?: ((date: Temporal.PlainDate) => void) | undefined;
  onViewChange?:
    ((view: CalendarRootView, details: CalendarRootChangeEventDetails) => void) | undefined;
  'onUpdate:view'?: ((view: CalendarRootView) => void) | undefined;
}

/** The props of `Calendar.Root` that the picker does not own, and the events that reach it. */
type CalendarProps = Omit<CalendarRootProps<DatePickerRootValue>, CalendarOwned> &
  CalendarListeners;

export interface DatePickerCalendarProps extends /* @vue-ignore */ CalendarProps {}

export interface DatePickerCalendarState extends CalendarRootState {}
