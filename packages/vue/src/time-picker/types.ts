import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { TimeValue } from '../common/date-time/temporal';
import type { OwnedKeys } from '../common/picker/field';
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
  TimeClockRootCommitEventDetails,
  TimeClockRootChangeEventReason,
  TimeClockRootProps,
  TimeClockRootState,
  TimeClockRootViewChangeEventDetails,
  TimeClockView,
} from '../time-clock/types';
import type {
  TimeFieldRootChangeEventReason,
  TimeFieldRootGranularity,
  TimeFieldRootProps,
  TimeFieldRootState,
} from '../time-field/types';
import type { TimePickerColumnUnit, TimePickerColumnValue } from './columns';

export type { TimePickerColumnUnit, TimePickerColumnValue } from './columns';

/** The kinds of value that the picker takes and gives back. */
export type TimePickerRootValue = TimeValue;

export type TimePickerRootGranularity = TimeFieldRootGranularity;

export type TimePickerRootChangeEventReason =
  TimeFieldRootChangeEventReason | TimeClockRootChangeEventReason;

export type TimePickerRootChangeEventDetails = ChangeEventDetails<TimePickerRootChangeEventReason>;

export type TimePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;

export type TimePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export interface TimePickerRootState {}

export interface TimePickerRootProps<Value extends TimePickerRootValue = Temporal.PlainTime> {
  /**
   * The value: a `Temporal.PlainTime`, `PlainDateTime` or `ZonedDateTime`, or `null` for no value.
   * A new value has the kind, the date and the zone of the value, else of `defaultValue`, else of
   * the last value.
   */
  modelValue?: Value | null | undefined;
  /** The value of a picker with no `modelValue`, at the mount and at a native reset of the form. */
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
   * A pick closes the popup. With no prop, a press on an item of `TimePicker.List` and the commit
   * of the last view of `TimePicker.Clock` close it, and a press in `TimePicker.Column` does not.
   * In a wrapper that declares this prop, give it the default `undefined`.
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The last unit that the field shows and that the clock selects.
   * @default 'minute'
   */
  granularity?: TimePickerRootGranularity | undefined;
  /**
   * Gives the kind, the date and the time zone of a first value. With no value, the clock shows its
   * time, and a column sets one unit of it. With none, that time is midnight.
   */
  referenceDate?: Value | undefined;
  /** The hour cycle. The default is the hour cycle of the locale. */
  hourCycle?: 12 | 24 | undefined;
  /**
   * The hour shows a leading zero. A 24-hour cycle always has one.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * The field shows no time zone name for a `Temporal.ZonedDateTime`.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest time. The list starts at it, the columns and the clock disable an earlier time,
   * and an earlier time makes the field invalid.
   */
  min?: Temporal.PlainTime | undefined;
  /**
   * The latest time. The list ends at it, the columns and the clock disable a later time, and a
   * later time makes the field invalid.
   */
  max?: Temporal.PlainTime | undefined;
  /**
   * The locale of each text. The default is the locale of the nearest `LocaleProvider`, else
   * `en-US`.
   */
  locale?: Intl.LocalesArgument | undefined;
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

export interface TimePickerRootEmits<Value extends TimePickerRootValue = Temporal.PlainTime> {
  /**
   * The user changes the value. The value is `null` while a segment is empty.
   * `details.cancel()` keeps the value as it was.
   */
  valueChange: [value: Value | null, details: TimePickerRootChangeEventDetails];
  /**
   * Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. A reset of
   * the form and `clear()` of a field emit it with no `valueChange`.
   */
  'update:modelValue': [value: Value | null];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: TimePickerRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
}

type FieldOwned = OwnedKeys<
  TimeFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'min'
  | 'max'
  | 'locale'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'name'
  | 'form'
>;

export interface TimePickerFieldProps extends /* @vue-ignore */ Omit<
  TimeFieldRootProps,
  FieldOwned
> {}

export interface TimePickerFieldState extends TimeFieldRootState {}

type TriggerOwned = OwnedKeys<
  PopoverTriggerProps,
  'disabled' | 'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
>;

export interface TimePickerTriggerProps extends /* @vue-ignore */ Omit<
  PopoverTriggerProps,
  TriggerOwned
> {
  /**
   * The user cannot press the trigger. A disabled or read-only picker also disables it.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface TimePickerTriggerState extends PopoverTriggerState {}

export interface TimePickerPositionerProps extends /* @vue-ignore */ Omit<
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

export interface TimePickerPositionerState extends PopoverPositionerState {}

export interface TimePickerPopupProps extends /* @vue-ignore */ Omit<
  PopoverPopupProps,
  OwnedKeys<PopoverPopupProps, 'initialFocus'>
> {
  /**
   * The element that gets the focus at the open. The default is the first list, column or clock in
   * the popup, else the default of `Popover.Popup`. `true`, `null` and a function that gives one of
   * them ask for that default. `false` moves no focus.
   */
  initialFocus?: PopoverPopupProps['initialFocus'] | undefined;
}

export interface TimePickerPopupState extends PopoverPopupState {}

export interface TimePickerListState {
  disabled: boolean;
  readonly: boolean;
}

export interface TimePickerListProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The minutes between two times. The list goes from `min` of the picker, else midnight, to
   * `max`, else the end of the day.
   * @default 30
   */
  step?: number | undefined;
}

export interface TimePickerItemState {
  /** The time of the value is the time of the item. */
  selected: boolean;
  disabled: boolean;
}

export interface TimePickerItemProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /** The time that the item gives. The `item` slot of `TimePicker.List` gives it. */
  time: Temporal.PlainTime;
  /**
   * The user cannot press the item.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface TimePickerColumnState {
  unit: TimePickerColumnUnit;
  disabled: boolean;
  readonly: boolean;
}

export interface TimePickerColumnProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The unit that the column sets. A column of day periods renders nothing in a 24-hour cycle. */
  unit: TimePickerColumnUnit;
  /**
   * The step of the hours, the minutes or the seconds.
   * @default 1
   */
  step?: number | undefined;
}

export interface TimePickerColumnItemState {
  /** The time of the value has the value of the item in the unit of the column. */
  selected: boolean;
  disabled: boolean;
}

export interface TimePickerColumnItemProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The value that the item sets: an hour, a minute or a second, or `'am'` or `'pm'`. The `item`
   * slot of `TimePicker.Column` gives it. An hour of a 12-hour cycle goes from 1 to 12.
   */
  value: TimePickerColumnValue;
  /**
   * The user cannot press the item. `min` and `max` of the picker also disable an item.
   * @default false
   */
  disabled?: boolean | undefined;
}

/** The events of `TimeClock.Root` that reach it from the part. */
interface ClockListeners {
  onValueCommitted?:
    ((value: TimePickerRootValue, details: TimeClockRootCommitEventDetails) => void) | undefined;
  onViewChange?:
    ((view: TimeClockView, details: TimeClockRootViewChangeEventDetails) => void) | undefined;
}

type ClockOwned = OwnedKeys<
  TimeClockRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'view'
  | 'defaultView'
  | 'granularity'
  | 'hourCycle'
  | 'min'
  | 'max'
  | 'locale'
  | 'disabled'
  | 'readonly'
>;

/** The props of `TimeClock.Root` that the picker does not own, and the events that reach it. */
type ClockProps = Omit<TimeClockRootProps, ClockOwned> & ClockListeners;

export interface TimePickerClockProps extends /* @vue-ignore */ ClockProps {
  /** The unit that the face shows. `v-model:view` binds it. */
  view?: TimeClockView | undefined;
  /**
   * The view of an uncontrolled clock at each open of the popup.
   * @default 'hour'
   */
  defaultView?: TimeClockView | undefined;
}

export interface TimePickerClockEmits {
  /** Comes after `viewChange` of the clock, unless a listener cancels it. `v-model:view` uses it. */
  'update:view': [view: TimeClockView];
}

export interface TimePickerClockState extends TimeClockRootState {}
