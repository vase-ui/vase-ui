import TimePickerClock from './TimePickerClock.vue';
import TimePickerColumn from './TimePickerColumn.vue';
import TimePickerColumnItem from './TimePickerColumnItem.vue';
import TimePickerField from './TimePickerField.vue';
import TimePickerItem from './TimePickerItem.vue';
import TimePickerList from './TimePickerList.vue';
import TimePickerPopup from './TimePickerPopup.vue';
import TimePickerPositioner from './TimePickerPositioner.vue';
import TimePickerRoot from './TimePickerRoot.vue';
import TimePickerTrigger from './TimePickerTrigger.vue';
import type {
  TimePickerClockProps,
  TimePickerClockState,
  TimePickerColumnItemProps,
  TimePickerColumnItemState,
  TimePickerColumnProps,
  TimePickerColumnState,
  TimePickerColumnUnit,
  TimePickerColumnValue,
  TimePickerFieldProps,
  TimePickerFieldState,
  TimePickerItemProps,
  TimePickerItemState,
  TimePickerListProps,
  TimePickerListState,
  TimePickerPopupProps,
  TimePickerPopupState,
  TimePickerPositionerProps,
  TimePickerPositionerState,
  TimePickerRootChangeEventDetails,
  TimePickerRootChangeEventReason,
  TimePickerRootGranularity,
  TimePickerRootOpenChangeEventDetails,
  TimePickerRootOpenChangeEventReason,
  TimePickerRootProps,
  TimePickerRootState,
  TimePickerRootValue,
  TimePickerTriggerProps,
  TimePickerTriggerState,
} from './types';

/**
 * Groups the parts of the picker and holds its value. It renders `Popover.Root`, so each part of
 * Popover, such as `Popover.Portal` and `Popover.Close`, works in it.
 * Renders no element.
 */
export const Root: typeof TimePickerRoot = TimePickerRoot;
export namespace Root {
  export type Props<Value extends TimePickerRootValue = Temporal.PlainTime> =
    TimePickerRootProps<Value>;
  export type State = TimePickerRootState;
  export type Value = TimePickerRootValue;
  export type Granularity = TimePickerRootGranularity;
  export type ChangeEventReason = TimePickerRootChangeEventReason;
  export type ChangeEventDetails = TimePickerRootChangeEventDetails;
  export type OpenChangeEventReason = TimePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = TimePickerRootOpenChangeEventDetails;
}

/**
 * The field of the picker: `TimeField.Root` with the value of the picker. Alt+ArrowDown in it
 * opens the popup.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const Field: typeof TimePickerField = TimePickerField;
export namespace Field {
  export type Props = TimePickerFieldProps;
  export type State = TimePickerFieldState;
}

/**
 * A button that opens the popup: `Popover.Trigger` of the picker.
 * Renders a `<button>` element.
 */
export const Trigger: typeof TimePickerTrigger = TimePickerTrigger;
export namespace Trigger {
  export type Props = TimePickerTriggerProps;
  export type State = TimePickerTriggerState;
}

/**
 * Places the popup at the field: `Popover.Positioner` of the picker.
 * Renders a `<div>` element.
 */
export const Positioner: typeof TimePickerPositioner = TimePickerPositioner;
export namespace Positioner {
  export type Props = TimePickerPositionerProps;
  export type State = TimePickerPositionerState;
}

/**
 * The container of the list, the columns or the clock: `Popover.Popup` of the picker. It gives the
 * focus to the first of them at each open.
 * Renders a `<div>` element.
 */
export const Popup: typeof TimePickerPopup = TimePickerPopup;
export namespace Popup {
  export type Props = TimePickerPopupProps;
  export type State = TimePickerPopupState;
}

/**
 * A list of times, by a step of minutes.
 * Renders a `<div>` element.
 */
export const List: typeof TimePickerList = TimePickerList;
export namespace List {
  export type Props = TimePickerListProps;
  export type State = TimePickerListState;
}

/**
 * A time of `TimePicker.List`. A press gives the time to the picker.
 * Renders a `<button>` element.
 */
export const Item: typeof TimePickerItem = TimePickerItem;
export namespace Item {
  export type Props = TimePickerItemProps;
  export type State = TimePickerItemState;
}

/**
 * A list of the values of one unit: the hours, the minutes, the seconds or the day periods.
 * Renders a `<div>` element.
 */
export const Column: typeof TimePickerColumn = TimePickerColumn;
export namespace Column {
  export type Props = TimePickerColumnProps;
  export type State = TimePickerColumnState;
  export type Unit = TimePickerColumnUnit;
  export type Value = TimePickerColumnValue;
}

/**
 * A value of `TimePicker.Column`. A press sets the unit of the time.
 * Renders a `<button>` element.
 */
export const ColumnItem: typeof TimePickerColumnItem = TimePickerColumnItem;
export namespace ColumnItem {
  export type Props = TimePickerColumnItemProps;
  export type State = TimePickerColumnItemState;
}

/**
 * The clock of the picker: `TimeClock.Root` with the value of the picker. The commit of the last
 * view closes the popup.
 * Renders a `<div>` element.
 */
export const Clock: typeof TimePickerClock = TimePickerClock;
export namespace Clock {
  export type Props = TimePickerClockProps;
  export type State = TimePickerClockState;
}
