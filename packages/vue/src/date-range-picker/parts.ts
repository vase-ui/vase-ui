import type { DateValue } from '../common/date-time/temporal';
import DateRangePickerCalendar from './DateRangePickerCalendar.vue';
import DateRangePickerEndField from './DateRangePickerEndField.vue';
import DateRangePickerPopup from './DateRangePickerPopup.vue';
import DateRangePickerPositioner from './DateRangePickerPositioner.vue';
import DateRangePickerRoot from './DateRangePickerRoot.vue';
import DateRangePickerStartField from './DateRangePickerStartField.vue';
import DateRangePickerTrigger from './DateRangePickerTrigger.vue';
import type {
  DateRangePickerCalendarProps,
  DateRangePickerCalendarState,
  DateRangePickerEndFieldProps,
  DateRangePickerEndFieldState,
  DateRangePickerPopupProps,
  DateRangePickerPopupState,
  DateRangePickerPositionerProps,
  DateRangePickerPositionerState,
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootChangeEventReason,
  DateRangePickerRootGranularity,
  DateRangePickerRootOpenChangeEventDetails,
  DateRangePickerRootOpenChangeEventReason,
  DateRangePickerRootProps,
  DateRangePickerRootState,
  DateRangePickerRootValue,
  DateRangePickerStartFieldProps,
  DateRangePickerStartFieldState,
  DateRangePickerTriggerProps,
  DateRangePickerTriggerState,
} from './types';

/**
 * Groups the parts of the picker and holds its range. It renders `Popover.Root`, so each part of
 * Popover, such as `Popover.Portal` and `Popover.Close`, works in it.
 * Renders no element.
 */
export const Root: typeof DateRangePickerRoot = DateRangePickerRoot;
export namespace Root {
  export type Props<Value extends DateValue = DateValue> = DateRangePickerRootProps<Value>;
  export type State = DateRangePickerRootState;
  export type Value<Value extends DateValue = DateValue> = DateRangePickerRootValue<Value>;
  export type Granularity = DateRangePickerRootGranularity;
  export type ChangeEventReason = DateRangePickerRootChangeEventReason;
  export type ChangeEventDetails = DateRangePickerRootChangeEventDetails;
  export type OpenChangeEventReason = DateRangePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = DateRangePickerRootOpenChangeEventDetails;
}

/**
 * The field of the first day: `DateField.Root` with the start of the range. Alt+ArrowDown in it
 * opens the popup.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const StartField: typeof DateRangePickerStartField = DateRangePickerStartField;
export namespace StartField {
  export type Props = DateRangePickerStartFieldProps;
  export type State = DateRangePickerStartFieldState;
}

/**
 * The field of the last day: `DateField.Root` with the end of the range. An end before the start
 * makes it invalid.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const EndField: typeof DateRangePickerEndField = DateRangePickerEndField;
export namespace EndField {
  export type Props = DateRangePickerEndFieldProps;
  export type State = DateRangePickerEndFieldState;
}

/**
 * A button that opens the popup: `Popover.Trigger` of the picker.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DateRangePickerTrigger = DateRangePickerTrigger;
export namespace Trigger {
  export type Props = DateRangePickerTriggerProps;
  export type State = DateRangePickerTriggerState;
}

/**
 * Places the popup at the two fields: `Popover.Positioner` of the picker.
 * Renders a `<div>` element.
 */
export const Positioner: typeof DateRangePickerPositioner = DateRangePickerPositioner;
export namespace Positioner {
  export type Props = DateRangePickerPositionerProps;
  export type State = DateRangePickerPositionerState;
}

/**
 * The container of the calendar: `Popover.Popup` of the picker. It gives the focus to the
 * calendar at each open.
 * Renders a `<div>` element.
 */
export const Popup: typeof DateRangePickerPopup = DateRangePickerPopup;
export namespace Popup {
  export type Props = DateRangePickerPopupProps;
  export type State = DateRangePickerPopupState;
}

/**
 * The calendar of the picker: `RangeCalendar.Root` with the range of the picker. The press that
 * gives the second end, or a drag, closes the popup.
 * Renders a `<div>` element.
 */
export const Calendar: typeof DateRangePickerCalendar = DateRangePickerCalendar;
export namespace Calendar {
  export type Props = DateRangePickerCalendarProps;
  export type State = DateRangePickerCalendarState;
}
