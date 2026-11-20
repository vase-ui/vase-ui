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
 * The field of the picker: `TimeField.Root` with the value of the picker. It takes the other props
 * of `TimeField.Root`, such as `id` and `step`, and it has the selectors of that part. Its form input
 * gives the value to a form. Alt+ArrowDown in it opens the popup.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const Field: typeof TimePickerField = TimePickerField;
export namespace Field {
  export type Props = TimePickerFieldProps;
  export type State = TimePickerFieldState;
}

/**
 * A button that opens the popup: `Popover.Trigger` of the picker. The `text` of its slots is the
 * time in the locale, or `undefined` with no value.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The popup is open.
 * @selector `[data-pressed]` The popup is open, and a press on the trigger or Alt+ArrowDown in the field opened it.
 * @selector `:disabled` The trigger is a native button, and the trigger or the picker is disabled or read-only.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the picker is disabled or read-only.
 */
export const Trigger: typeof TimePickerTrigger = TimePickerTrigger;
export namespace Trigger {
  export type Props = TimePickerTriggerProps;
  export type State = TimePickerTriggerState;
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
export const Positioner: typeof TimePickerPositioner = TimePickerPositioner;
export namespace Positioner {
  export type Props = TimePickerPositionerProps;
  export type State = TimePickerPositionerState;
}

/**
 * The container of the list, the columns or the clock: `Popover.Popup` of the picker. It gives the
 * focus to the first of them at each open.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on that side: `start`, `center` or `end`.
 * @selector `[data-instant]` The popup changes with no animation: `click` after a key opened it, `dismiss` after Escape closed it, or `focus` after the focus left it.
 * @selector `[hidden]` The popup is closed, and `keepMounted` of `Popover.Portal` keeps it in the DOM.
 */
export const Popup: typeof TimePickerPopup = TimePickerPopup;
export namespace Popup {
  export type Props = TimePickerPopupProps;
  export type State = TimePickerPopupState;
}

/**
 * A list of times, by a step of minutes.
 * Renders a `<div>` element.
 * @selector `[aria-disabled="true"]` The picker is disabled.
 * @selector `[aria-readonly="true"]` The picker is read-only.
 */
export const List: typeof TimePickerList = TimePickerList;
export namespace List {
  export type Props = TimePickerListProps;
  export type State = TimePickerListState;
}

/**
 * A time of `TimePicker.List`. A press gives the time to the picker.
 * Renders a `<button>` element.
 * @selector `[aria-selected="true"]` The time of the item is the time of the value.
 * @selector `:disabled` The item is a native button, and the item or the picker is disabled.
 * @selector `[aria-disabled="true"]` The item is another element, and the item or the picker is disabled.
 */
export const Item: typeof TimePickerItem = TimePickerItem;
export namespace Item {
  export type Props = TimePickerItemProps;
  export type State = TimePickerItemState;
}

/**
 * A list of the values of one unit: the hours, the minutes, the seconds or the day periods. Its name
 * is the name of its unit in the locale.
 * Renders a `<div>` element.
 * @selector `[aria-disabled="true"]` The picker is disabled.
 * @selector `[aria-readonly="true"]` The picker is read-only.
 */
export const Column: typeof TimePickerColumn = TimePickerColumn;
export namespace Column {
  export type Props = TimePickerColumnProps;
  export type State = TimePickerColumnState;
  export type Unit = TimePickerColumnUnit;
  export type Value = TimePickerColumnValue;
}

/**
 * A value of `TimePicker.Column`. A press sets the unit of the time, keeps the other units, and
 * moves the time into `min` and `max`.
 * Renders a `<button>` element.
 * @selector `[aria-selected="true"]` The value of the item is the unit of the time of the value.
 * @selector `:disabled` The item is a native button, and the item or the picker is disabled, or its value has no time between `min` and `max`.
 * @selector `[aria-disabled="true"]` The item is another element, and the item or the picker is disabled, or its value has no time between `min` and `max`.
 */
export const ColumnItem: typeof TimePickerColumnItem = TimePickerColumnItem;
export namespace ColumnItem {
  export type Props = TimePickerColumnItemProps;
  export type State = TimePickerColumnItemState;
}

/**
 * The clock of the picker: `TimeClock.Root` with the value of the picker. It takes the other props
 * and events of `TimeClock.Root`, such as `minuteStep` and `valueCommitted`, and it has the
 * selectors of that part. The commit of the last view closes the popup when `closeOnSelect` of the
 * root allows it.
 * Renders a `<div>` element.
 */
export const Clock: typeof TimePickerClock = TimePickerClock;
export namespace Clock {
  export type Props = TimePickerClockProps;
  export type State = TimePickerClockState;
}
