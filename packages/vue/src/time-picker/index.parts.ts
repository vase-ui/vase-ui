import type { TimeValue } from '../internals/date-time/temporal';
import TimePickerClock from './clock/TimePickerClock.vue';
import type { TimePickerClockProps, TimePickerClockState } from './clock/TimePickerClock.vue';
import TimePickerColumn from './column/TimePickerColumn.vue';
import type {
  TimePickerColumnProps,
  TimePickerColumnState,
  TimePickerColumnUnit,
  TimePickerColumnValue,
} from './column/TimePickerColumn.vue';
import TimePickerColumnItem from './column-item/TimePickerColumnItem.vue';
import type {
  TimePickerColumnItemProps,
  TimePickerColumnItemState,
} from './column-item/TimePickerColumnItem.vue';
import TimePickerField from './field/TimePickerField.vue';
import type { TimePickerFieldProps, TimePickerFieldState } from './field/TimePickerField.vue';
import TimePickerItem from './item/TimePickerItem.vue';
import type { TimePickerItemProps, TimePickerItemState } from './item/TimePickerItem.vue';
import TimePickerList from './list/TimePickerList.vue';
import type { TimePickerListProps, TimePickerListState } from './list/TimePickerList.vue';
import TimePickerPopup from './popup/TimePickerPopup.vue';
import type { TimePickerPopupProps, TimePickerPopupState } from './popup/TimePickerPopup.vue';
import TimePickerPositioner from './positioner/TimePickerPositioner.vue';
import type {
  TimePickerPositionerProps,
  TimePickerPositionerState,
} from './positioner/TimePickerPositioner.vue';
import TimePickerRoot from './root/TimePickerRoot.vue';
import type {
  TimePickerRootActions,
  TimePickerRootChangeEventDetails,
  TimePickerRootChangeEventReason,
  TimePickerRootGranularity,
  TimePickerRootOpenChangeEventDetails,
  TimePickerRootOpenChangeEventReason,
  TimePickerRootProps,
  TimePickerRootState,
  TimePickerRootValue,
} from './root/TimePickerRoot.vue';
import TimePickerTrigger from './trigger/TimePickerTrigger.vue';
import type {
  TimePickerTriggerProps,
  TimePickerTriggerState,
} from './trigger/TimePickerTrigger.vue';

/**
 * Groups all time picker parts and manages their state.
 * Renders a popover root and no HTML element of its own.
 */
export const Root: typeof TimePickerRoot = TimePickerRoot;
export namespace Root {
  export type State = TimePickerRootState;
  export type Props<Value extends TimeValue = Temporal.PlainTime> = TimePickerRootProps<Value>;
  export type Value = TimePickerRootValue;
  export type Granularity = TimePickerRootGranularity;
  export type Actions = TimePickerRootActions;
  export type ChangeEventReason = TimePickerRootChangeEventReason;
  export type ChangeEventDetails = TimePickerRootChangeEventDetails;
  export type OpenChangeEventReason = TimePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = TimePickerRootOpenChangeEventDetails;
}

/**
 * The field that shows the value of the picker in segments.
 * Renders a `TimeField.Root`, so it has a `<div>` element and a hidden `<input>` beside it.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Field: typeof TimePickerField = TimePickerField;
export namespace Field {
  export type State = TimePickerFieldState;
  export type Props = TimePickerFieldProps;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof TimePickerTrigger = TimePickerTrigger;
export namespace Trigger {
  export type State = TimePickerTriggerState;
  export type Props = TimePickerTriggerProps;
}

/**
 * Positions the popup against the field.
 * Renders a `<div>` element.
 */
export const Positioner: typeof TimePickerPositioner = TimePickerPositioner;
export namespace Positioner {
  export type State = TimePickerPositionerState;
  export type Props = TimePickerPositionerProps;
}

/**
 * A list of times at a step, from which the user picks the time of the picker.
 * Renders a `<div>` element with the role `listbox`.
 */
export const List: typeof TimePickerList = TimePickerList;
export namespace List {
  export type State = TimePickerListState;
  export type Props = TimePickerListProps;
}

/**
 * A time in a list. A press on it sets the time of the picker.
 * Renders a `<div>` element with the role `option`.
 */
export const Item: typeof TimePickerItem = TimePickerItem;
export namespace Item {
  export type State = TimePickerItemState;
  export type Props = TimePickerItemProps;
}

/**
 * A list of the values of one unit, from which the user sets that unit of the time of the picker.
 * Renders a `<div>` element with the role `listbox`.
 */
export const Column: typeof TimePickerColumn = TimePickerColumn;
export namespace Column {
  export type State = TimePickerColumnState;
  export type Props = TimePickerColumnProps;
  export type Unit = TimePickerColumnUnit;
  export type Value = TimePickerColumnValue;
}

/**
 * A value in a column. A press on it sets one unit of the time of the picker.
 * Renders a `<div>` element with the role `option`.
 */
export const ColumnItem: typeof TimePickerColumnItem = TimePickerColumnItem;
export namespace ColumnItem {
  export type State = TimePickerColumnItemState;
  export type Props = TimePickerColumnItemProps;
}

/**
 * A clock face that sets the time of the picker.
 * Renders a `TimeClock.Root`, so it has a `<div>` element.
 */
export const Clock: typeof TimePickerClock = TimePickerClock;
export namespace Clock {
  export type State = TimePickerClockState;
  export type Props = TimePickerClockProps;
}

/**
 * A container for the popup content.
 * Renders a `<div>` element.
 */
export const Popup: typeof TimePickerPopup = TimePickerPopup;
export namespace Popup {
  export type State = TimePickerPopupState;
  export type Props = TimePickerPopupProps;
}

export { Arrow, Backdrop, Close, Description, Portal, Title } from '../popover/parts';
