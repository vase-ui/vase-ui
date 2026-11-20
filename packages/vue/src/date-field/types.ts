import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'vue';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldChangeEventReason,
  DateTimeFieldGranularity,
  DateTimeFieldSegment,
  DateTimeFieldState,
} from '../common/date-time-field/field';
import type { DateTimeFieldSegmentState } from '../common/date-time-field/segment';
import type { DateMatcher } from '../internals/date-time/matchers';
import type { DateValue } from '../internals/date-time/temporal';

/** The kinds of value that the field takes and gives back. */
export type DateFieldRootValue = DateValue | Temporal.PlainYearMonth;

export type DateFieldRootGranularity = DateTimeFieldGranularity;

export type DateFieldRootChangeEventReason = DateTimeFieldChangeEventReason;

export type DateFieldRootChangeEventDetails = DateTimeFieldChangeEventDetails;

export interface DateFieldRootState extends DateTimeFieldState {}

export interface DateFieldRootProps<
  Value extends DateFieldRootValue = DateFieldRootValue,
> extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  /**
   * The value: a `Temporal.PlainDate`, `PlainDateTime`, `ZonedDateTime` or `PlainYearMonth`, or
   * `null` for no value. The field gives a value of the same kind, calendar, time and time zone.
   */
  modelValue?: Value | null;
  /** The first value of a field with no `modelValue`. */
  defaultValue?: Value | null;
  /**
   * Gives the kind, the time zone, the calendar and the hidden units of a first value. An arrow key
   * in an empty segment takes its number from this value, else from today.
   */
  referenceDate?: DateFieldRootValue;
  /**
   * The last unit that the field shows. A date shows `day` or `month`, and a year and month shows
   * `month`. A date and time shows each unit, with `minute` as the default. With no value, it also
   * gives the kind of the first value.
   */
  granularity?: DateFieldRootGranularity;
  /** The hour cycle. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24;
  /** The day, the month and the hour show a leading zero. */
  forceLeadingZeros?: boolean;
  /** The field shows no time zone name for a `Temporal.ZonedDateTime`. */
  hideTimeZone?: boolean;
  /**
   * The locale of the layout, the names and the digits. The default is the locale of the nearest
   * `LocaleProvider`, else `en-US`.
   */
  locale?: Intl.LocalesArgument;
  /**
   * The calendar that the field shows, such as `gregory` or `persian`. The default is the calendar
   * of a value that is not ISO, else the calendar of the locale. A value keeps its own calendar.
   */
  calendar?: string;
  /**
   * The time zone of today, for an arrow key in an empty segment. The default is the zone of a
   * `Temporal.ZonedDateTime` value, else the zone of the runtime.
   */
  timeZone?: string;
  /** The dates that the field refuses: a date, a range, a day of the week, a function or a list. */
  unavailableDates?: DateMatcher;
  /**
   * The earliest value. A `Temporal.PlainDate` limits whole days. A limit with a time limits the
   * time of a field that shows a time.
   */
  min?: DateValue;
  /**
   * The latest value. A `Temporal.PlainDate` limits whole days. A limit with a time limits the time
   * of a field that shows a time.
   */
  max?: DateValue;
  /** The `id` of the first segment. A `<label for>` gives it the focus. */
  id?: string;
  /** The name of the form input. The name of a `Field` wins. */
  name?: string;
  /** The `id` of the form of the form input, for a field outside that form. */
  form?: string;
  /** The `autocomplete` of the form input. */
  autocomplete?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

/**
 * An item of the layout. The user edits an item with `editable: true`. Each other item has a
 * `text`: a separator, an era or the name of a time zone.
 */
export type DateFieldInputSegment = DateTimeFieldSegment;

export interface DateFieldInputState extends DateFieldRootState {}

export interface DateFieldInputProps extends /* @vue-ignore */ HTMLAttributes {}

export interface DateFieldSegmentState extends DateTimeFieldSegmentState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type SegmentAttributes = Omit<InputHTMLAttributes, 'autocomplete'> & {
  autocomplete?: string | null | undefined;
};

export interface DateFieldSegmentProps extends /* @vue-ignore */ SegmentAttributes {
  /** The item that the segment edits. The `segment` slot of `DateField.Input` gives it. */
  segment: Extract<DateFieldInputSegment, { editable: true }>;
}

export interface DateFieldLiteralState extends DateFieldRootState {
  type: 'literal' | 'era' | 'timeZoneName';
}

export interface DateFieldLiteralProps extends /* @vue-ignore */ HTMLAttributes {
  /** The item that the part shows. The `segment` slot of `DateField.Input` gives it. */
  segment: Extract<DateFieldInputSegment, { editable: false }>;
}

export interface DateFieldClearState extends DateFieldRootState {}

export interface DateFieldClearProps extends /* @vue-ignore */ Omit<
  ButtonHTMLAttributes,
  'disabled'
> {
  /** The user cannot press the button. It is also disabled while the field is empty. */
  disabled?: boolean;
}
