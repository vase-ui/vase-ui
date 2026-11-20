import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldChangeEventReason,
  DateTimeFieldSegment,
  DateTimeFieldState,
} from '../common/date-time-field/field';
import type { DateTimeFieldSegmentState } from '../common/date-time-field/segment';
import type { TimeValue } from '../internals/date-time/temporal';

/** The kinds of value that the field takes and gives back. */
export type TimeFieldRootValue = TimeValue;

export type TimeFieldRootGranularity = 'hour' | 'minute' | 'second';

export type TimeFieldRootChangeEventReason = DateTimeFieldChangeEventReason;

export type TimeFieldRootChangeEventDetails = DateTimeFieldChangeEventDetails;

export interface TimeFieldRootState extends DateTimeFieldState {}

export interface TimeFieldRootProps<Value extends TimeFieldRootValue = Temporal.PlainTime>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The value: a `Temporal.PlainTime`, `PlainDateTime` or `ZonedDateTime`, or `null` for no value.
   * The field gives a value of the same kind, with the date and the time zone of the value.
   */
  modelValue?: Value | null;
  /** The first value of a field with no `modelValue`. */
  defaultValue?: Value | null;
  /**
   * Gives the kind, the date and the time zone of a first value. An arrow key in an empty segment
   * takes its number from this value, else from midnight.
   */
  referenceDate?: Value;
  /**
   * The last unit that the field shows.
   * @default 'minute'
   */
  granularity?: TimeFieldRootGranularity;
  /** The hour cycle. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24;
  /** The hour shows a leading zero. A 24-hour cycle always has one. */
  forceLeadingZeros?: boolean;
  /** The field shows no time zone name for a `Temporal.ZonedDateTime`. */
  hideTimeZone?: boolean;
  /**
   * The locale of the layout, the names and the digits. The default is the locale of the nearest
   * `LocaleProvider`, else `en-US`.
   */
  locale?: Intl.LocalesArgument;
  /** The earliest time. A `max` before `min` gives a range through midnight. */
  min?: Temporal.PlainTime;
  /** The latest time. */
  max?: Temporal.PlainTime;
  /** The step of the time in seconds, from `min`, else from midnight. */
  step?: number;
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
 * `text`: a separator or the name of a time zone.
 */
export type TimeFieldInputSegment = DateTimeFieldSegment;

export interface TimeFieldInputState extends TimeFieldRootState {}

export interface TimeFieldInputProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TimeFieldSegmentState extends DateTimeFieldSegmentState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type SegmentAttributes = Omit<InputHTMLAttributes, 'autocomplete'> & {
  autocomplete?: string | null | undefined;
};

export interface TimeFieldSegmentProps extends /* @vue-ignore */ SegmentAttributes {
  /** The item that the segment edits. The `segment` slot of `TimeField.Input` gives it. */
  segment: Extract<TimeFieldInputSegment, { editable: true }>;
}

export interface TimeFieldLiteralState extends TimeFieldRootState {
  type: 'literal' | 'era' | 'timeZoneName';
}

export interface TimeFieldLiteralProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The item that the part shows. The `segment` slot of `TimeField.Input` gives it. */
  segment: Extract<TimeFieldInputSegment, { editable: false }>;
}

export interface TimeFieldClearState extends TimeFieldRootState {}

export interface TimeFieldClearProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /** The user cannot press the button. It is also disabled while the field is empty. */
  disabled?: boolean;
}
