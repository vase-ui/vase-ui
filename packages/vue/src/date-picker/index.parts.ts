import DatePickerCalendar from './calendar/DatePickerCalendar.vue';
import type {
  DatePickerCalendarProps,
  DatePickerCalendarState,
} from './calendar/DatePickerCalendar.vue';
import DatePickerField from './field/DatePickerField.vue';
import type { DatePickerFieldProps, DatePickerFieldState } from './field/DatePickerField.vue';
import DatePickerPopup from './popup/DatePickerPopup.vue';
import type { DatePickerPopupProps, DatePickerPopupState } from './popup/DatePickerPopup.vue';
import DatePickerPositioner from './positioner/DatePickerPositioner.vue';
import type {
  DatePickerPositionerProps,
  DatePickerPositionerState,
} from './positioner/DatePickerPositioner.vue';
import DatePickerRoot from './root/DatePickerRoot.vue';
import type {
  DatePickerRootActions,
  DatePickerRootChangeEventDetails,
  DatePickerRootChangeEventReason,
  DatePickerRootGranularity,
  DatePickerRootOpenChangeEventDetails,
  DatePickerRootOpenChangeEventReason,
  DatePickerRootProps,
  DatePickerRootState,
  DatePickerRootValue,
} from './root/DatePickerRoot.vue';
import DatePickerTimeField from './time-field/DatePickerTimeField.vue';
import type {
  DatePickerTimeFieldProps,
  DatePickerTimeFieldState,
} from './time-field/DatePickerTimeField.vue';
import DatePickerTrigger from './trigger/DatePickerTrigger.vue';
import type {
  DatePickerTriggerProps,
  DatePickerTriggerState,
} from './trigger/DatePickerTrigger.vue';

/**
 * Groups all date picker parts and manages their state.
 * Renders a popover root and no HTML element of its own.
 */
export const Root: typeof DatePickerRoot = DatePickerRoot;
export namespace Root {
  export type State = DatePickerRootState;
  export type Props<Value extends DatePickerRootValue = DatePickerRootValue> =
    DatePickerRootProps<Value>;
  export type Value = DatePickerRootValue;
  export type Granularity = DatePickerRootGranularity;
  export type Actions = DatePickerRootActions;
  export type ChangeEventReason = DatePickerRootChangeEventReason;
  export type ChangeEventDetails = DatePickerRootChangeEventDetails;
  export type OpenChangeEventReason = DatePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = DatePickerRootOpenChangeEventDetails;
}

/**
 * The field that shows the value of the picker in segments.
 * Renders a `DateField.Root`: a `<div>` element with a hidden form `<input>` element in it.
 */
export const Field: typeof DatePickerField = DatePickerField;
export namespace Field {
  export type State = DatePickerFieldState;
  export type Props = DatePickerFieldProps;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DatePickerTrigger = DatePickerTrigger;
export namespace Trigger {
  export type State = DatePickerTriggerState;
  export type Props = DatePickerTriggerProps;
}

/**
 * Positions the popup against the field.
 * Renders a `<div>` element.
 */
export const Positioner: typeof DatePickerPositioner = DatePickerPositioner;
export namespace Positioner {
  export type State = DatePickerPositionerState;
  export type Props = DatePickerPositionerProps;
}

/**
 * The calendar that selects the value of the picker.
 * Renders a `Calendar.Root`, so it has a `<div>` element.
 */
export const Calendar: typeof DatePickerCalendar = DatePickerCalendar;
export namespace Calendar {
  export type State = DatePickerCalendarState;
  export type Props = DatePickerCalendarProps;
}

/**
 * A field for the time of a value that has a time.
 * Renders a `TimeField.Root`: a `<div>` element with a hidden form `<input>` element in it.
 */
export const TimeField: typeof DatePickerTimeField = DatePickerTimeField;
export namespace TimeField {
  export type State = DatePickerTimeFieldState;
  export type Props = DatePickerTimeFieldProps;
}

/**
 * A container for the popup content.
 * Renders a `<div>` element.
 */
export const Popup: typeof DatePickerPopup = DatePickerPopup;
export namespace Popup {
  export type State = DatePickerPopupState;
  export type Props = DatePickerPopupProps;
}

export { Arrow, Backdrop, Close, Description, Portal, Title } from '../popover/parts';
