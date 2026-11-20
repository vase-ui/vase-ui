import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { ChangeEventDetails, GenericEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { TimeValue } from '../common/date-time/temporal';
import type { TimeClockDayPeriodValue, TimeClockFaceNumber, TimeClockView } from './views';

export type { TimeClockDayPeriodValue, TimeClockFaceNumber, TimeClockView } from './views';

export interface TimeClockRootState {
  /** The unit that the face shows. */
  view: TimeClockView;
  disabled: boolean;
  readonly: boolean;
  /** The user presses or drags on the face. */
  dragging: boolean;
  /** The clock has no value. */
  empty: boolean;
}

export interface TimeClockRootProps<Value extends TimeValue = Temporal.PlainTime>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The value: a `Temporal.PlainTime`, `PlainDateTime` or `ZonedDateTime`, or `null` for no value.
   * A new value keeps the date and the time zone of the value.
   */
  modelValue?: Value | null;
  /** The first value of a clock with no `modelValue`. */
  defaultValue?: Value | null;
  /** The unit that the face shows. `v-model:view` uses it. */
  view?: TimeClockView;
  /**
   * The first view of a clock with no `view`.
   * @default 'hour'
   */
  defaultView?: TimeClockView;
  /**
   * The last unit that the user selects. A commit shows the next view, up to this one.
   * @default 'minute'
   */
  granularity?: TimeClockView;
  /** The hour cycle of the face. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24;
  /**
   * The step of the minutes.
   * @default 1
   */
  minuteStep?: number;
  /**
   * The step of the seconds.
   * @default 1
   */
  secondStep?: number;
  /** The earliest time that the user can select. */
  min?: Temporal.PlainTime;
  /** The latest time that the user can select. */
  max?: Temporal.PlainTime;
  /** Returns `true` for a time that the user cannot select in the view. */
  disabledTimes?: (time: Temporal.PlainTime, view: TimeClockView) => boolean;
  /**
   * The time that the face shows with no value, and the kind, the date and the time zone of a first
   * value. With none, the face shows 00:00, and the first value is a `Temporal.PlainTime`.
   */
  referenceDate?: Value;
  /**
   * The locale of the texts and of the hour cycle. The default is the locale of the nearest
   * `LocaleProvider`, else `en-US`.
   */
  locale?: Intl.LocalesArgument;
  disabled?: boolean;
  readonly?: boolean;
}

export type TimeClockRootChangeEventReason = 'drag' | 'keyboard' | 'input-change' | 'item-press';
export type TimeClockRootChangeEventDetails = ChangeEventDetails<TimeClockRootChangeEventReason>;

export type TimeClockRootCommitEventReason = 'drag' | 'keyboard';
export type TimeClockRootCommitEventDetails = GenericEventDetails<TimeClockRootCommitEventReason>;

export type TimeClockRootViewChangeEventReason = 'trigger-press' | 'drag' | 'keyboard';
export type TimeClockRootViewChangeEventDetails =
  ChangeEventDetails<TimeClockRootViewChangeEventReason>;

export interface TimeClockFaceState extends TimeClockRootState {}

export interface TimeClockFaceProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The `aria-valuetext` of the range input, for the number that the face shows. The default is
   * the number with its unit, such as `30 minutes`. An `aria-valuetext` attribute wins.
   */
  getAriaValueText?: (value: number, view: TimeClockView) => string;
}

export interface TimeClockHandState extends TimeClockRootState {
  /** The hand points at the inner ring of a 24-hour face. */
  inner: boolean;
  /** The hand points between two numbers of the face. */
  betweenNumbers: boolean;
}

export interface TimeClockHandProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TimeClockNumberState extends TimeClockRootState {
  /** The time of the clock selects the number. */
  selected: boolean;
  /** The number is on the inner ring of a 24-hour face. */
  inner: boolean;
}

export interface TimeClockNumberProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The number that the part shows. The `number` slot of `TimeClock.Face` gives it. */
  number: TimeClockFaceNumber;
}

export interface TimeClockDayPeriodState extends TimeClockRootState {
  /** The time of the clock is in the day period. */
  selected: boolean;
}

export interface TimeClockDayPeriodProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'value'> {
  /** The day period that the button selects. Its text is that period in the locale. */
  value: TimeClockDayPeriodValue;
}

export interface TimeClockViewTriggerState extends TimeClockRootState {
  /** The face shows the unit of the trigger. */
  active: boolean;
}

export interface TimeClockViewTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /** The unit that the face shows after a press. The text is that unit of the time. */
  view: TimeClockView;
}
