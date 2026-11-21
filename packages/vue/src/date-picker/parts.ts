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
  DatePickerRootEmits,
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
  export type Emits<Value extends DatePickerRootValue = DatePickerRootValue> =
    DatePickerRootEmits<Value>;
  export type State = DatePickerRootState;
  export type Value = DatePickerRootValue;
  export type Granularity = DatePickerRootGranularity;
  export type ChangeEventReason = DatePickerRootChangeEventReason;
  export type ChangeEventDetails = DatePickerRootChangeEventDetails;
  export type OpenChangeEventReason = DatePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = DatePickerRootOpenChangeEventDetails;
}

/**
 * The field of the picker: `DateField.Root` with the value of the picker. It takes the other props
 * of `DateField.Root`, such as `id`, and it has the selectors of that part. Its form input gives the
 * value to a form. Alt+ArrowDown in it opens the popup.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const Field: typeof DatePickerField = DatePickerField;
export namespace Field {
  export type Props = DatePickerFieldProps;
  export type State = DatePickerFieldState;
}

/**
 * A button that opens the popup: `Popover.Trigger` of the picker. The `text` of its slots is the
 * value in the locale, or `undefined` with no value.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The popup is open.
 * @selector `[data-pressed]` The popup is open, and a press on the trigger or Alt+ArrowDown in the field opened it.
 * @selector `:disabled` The trigger is a native button, and the trigger or the picker is disabled or read-only.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the picker is disabled or read-only.
 */
export const Trigger: typeof DatePickerTrigger = DatePickerTrigger;
export namespace Trigger {
  export type Props = DatePickerTriggerProps;
  export type State = DatePickerTriggerState;
}

/**
 * Places the popup at the field: `Popover.Positioner` of the picker.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on that side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of the view.
 * @cssVariable `--anchor-width` The width of the anchor.
 * @cssVariable `--anchor-height` The height of the anchor.
 * @cssVariable `--available-width` The width that the popup has before it goes out of its collision boundary.
 * @cssVariable `--available-height` The height that the popup has before it goes out of its collision boundary.
 * @cssVariable `--transform-origin` The `transform-origin` that makes the popup grow from its anchor.
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
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on that side: `start`, `center` or `end`.
 * @selector `[data-instant]` The popup changes with no animation: `click` after a key opened it, `dismiss` after Escape closed it, or `focus` after the focus left it.
 * @selector `[hidden]` The popup is closed, and `keepMounted` of `Popover.Portal` keeps it in the DOM.
 */
export const Popup: typeof DatePickerPopup = DatePickerPopup;
export namespace Popup {
  export type Props = DatePickerPopupProps;
  export type State = DatePickerPopupState;
}

/**
 * The calendar of the picker: `Calendar.Root` with the value of the picker. It takes the other
 * props and events of `Calendar.Root`, such as `numberOfMonths` and `monthChange`, and it has the
 * selectors of that part. A pick closes the popup when `closeOnSelect` of the root allows it.
 * Renders a `<div>` element.
 */
export const Calendar: typeof DatePickerCalendar = DatePickerCalendar;
export namespace Calendar {
  export type Props = DatePickerCalendarProps;
  export type State = DatePickerCalendarState;
}

/**
 * A field for the time of the value: `TimeField.Root` with the value of the picker. It takes the
 * other props of `TimeField.Root`, such as `step`, and it has the selectors of that part. It gives
 * no value to a form, and a `Field` around the picker does not name it.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const TimeField: typeof DatePickerTimeField = DatePickerTimeField;
export namespace TimeField {
  export type Props = DatePickerTimeFieldProps;
  export type State = DatePickerTimeFieldState;
}
