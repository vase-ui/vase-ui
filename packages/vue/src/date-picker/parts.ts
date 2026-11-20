import DatePickerCalendar from './DatePickerCalendar.vue';
import DatePickerField from './DatePickerField.vue';
import DatePickerPopup from './DatePickerPopup.vue';
import DatePickerPositioner from './DatePickerPositioner.vue';
import DatePickerRoot from './DatePickerRoot.vue';
import DatePickerTimeField from './DatePickerTimeField.vue';
import DatePickerTrigger from './DatePickerTrigger.vue';
import type {
  DatePickerCalendarProps,
  DatePickerCalendarState,
  DatePickerFieldProps,
  DatePickerFieldState,
  DatePickerPopupProps,
  DatePickerPopupState,
  DatePickerPositionerProps,
  DatePickerPositionerState,
  DatePickerRootChangeEventDetails,
  DatePickerRootChangeEventReason,
  DatePickerRootGranularity,
  DatePickerRootOpenChangeEventDetails,
  DatePickerRootOpenChangeEventReason,
  DatePickerRootProps,
  DatePickerRootState,
  DatePickerRootValue,
  DatePickerTimeFieldProps,
  DatePickerTimeFieldState,
  DatePickerTriggerProps,
  DatePickerTriggerState,
} from './types';

/**
 * Groups the parts of the picker and holds its value. It renders `Popover.Root`, so each part of
 * Popover, such as `Popover.Portal` and `Popover.Close`, works in it.
 * Renders no element.
 */
export const Root: typeof DatePickerRoot = DatePickerRoot;
export namespace Root {
  export type Props<Value extends DatePickerRootValue = DatePickerRootValue> =
    DatePickerRootProps<Value>;
  export type State = DatePickerRootState;
  export type Value = DatePickerRootValue;
  export type Granularity = DatePickerRootGranularity;
  export type ChangeEventReason = DatePickerRootChangeEventReason;
  export type ChangeEventDetails = DatePickerRootChangeEventDetails;
  export type OpenChangeEventReason = DatePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = DatePickerRootOpenChangeEventDetails;
}

/**
 * The field of the picker: `DateField.Root` with the value of the picker. Alt+ArrowDown in it
 * opens the popup.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const Field: typeof DatePickerField = DatePickerField;
export namespace Field {
  export type Props = DatePickerFieldProps;
  export type State = DatePickerFieldState;
}

/**
 * A button that opens the popup: `Popover.Trigger` of the picker.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DatePickerTrigger = DatePickerTrigger;
export namespace Trigger {
  export type Props = DatePickerTriggerProps;
  export type State = DatePickerTriggerState;
}

/**
 * Places the popup at the field: `Popover.Positioner` of the picker.
 * Renders a `<div>` element.
 */
export const Positioner: typeof DatePickerPositioner = DatePickerPositioner;
export namespace Positioner {
  export type Props = DatePickerPositionerProps;
  export type State = DatePickerPositionerState;
}

/**
 * The container of the calendar: `Popover.Popup` of the picker. It gives the focus to the
 * calendar at each open.
 * Renders a `<div>` element.
 */
export const Popup: typeof DatePickerPopup = DatePickerPopup;
export namespace Popup {
  export type Props = DatePickerPopupProps;
  export type State = DatePickerPopupState;
}

/**
 * The calendar of the picker: `Calendar.Root` with the value of the picker. A pick closes the
 * popup.
 * Renders a `<div>` element.
 */
export const Calendar: typeof DatePickerCalendar = DatePickerCalendar;
export namespace Calendar {
  export type Props = DatePickerCalendarProps;
  export type State = DatePickerCalendarState;
}

/**
 * A field for the time of the value: `TimeField.Root` with the value of the picker.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const TimeField: typeof DatePickerTimeField = DatePickerTimeField;
export namespace TimeField {
  export type Props = DatePickerTimeFieldProps;
  export type State = DatePickerTimeFieldState;
}
