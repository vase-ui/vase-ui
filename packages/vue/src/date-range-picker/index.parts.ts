import type { DateValue } from '../internals/date-time/temporal';
import DateRangePickerCalendar from './calendar/DateRangePickerCalendar.vue';
import type {
  DateRangePickerCalendarProps,
  DateRangePickerCalendarState,
} from './calendar/DateRangePickerCalendar.vue';
import DateRangePickerEndField from './end-field/DateRangePickerEndField.vue';
import type {
  DateRangePickerEndFieldProps,
  DateRangePickerEndFieldState,
} from './end-field/DateRangePickerEndField.vue';
import DateRangePickerPopup from './popup/DateRangePickerPopup.vue';
import type {
  DateRangePickerPopupProps,
  DateRangePickerPopupState,
} from './popup/DateRangePickerPopup.vue';
import DateRangePickerPositioner from './positioner/DateRangePickerPositioner.vue';
import type {
  DateRangePickerPositionerProps,
  DateRangePickerPositionerState,
} from './positioner/DateRangePickerPositioner.vue';
import DateRangePickerRoot from './root/DateRangePickerRoot.vue';
import type {
  DateRangePickerRootActions,
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootChangeEventReason,
  DateRangePickerRootGranularity,
  DateRangePickerRootOpenChangeEventDetails,
  DateRangePickerRootOpenChangeEventReason,
  DateRangePickerRootProps,
  DateRangePickerRootState,
  DateRangePickerRootValue,
} from './root/DateRangePickerRoot.vue';
import DateRangePickerStartField from './start-field/DateRangePickerStartField.vue';
import type {
  DateRangePickerStartFieldProps,
  DateRangePickerStartFieldState,
} from './start-field/DateRangePickerStartField.vue';
import DateRangePickerTrigger from './trigger/DateRangePickerTrigger.vue';
import type {
  DateRangePickerTriggerProps,
  DateRangePickerTriggerState,
} from './trigger/DateRangePickerTrigger.vue';

/**
 * Groups all date range picker parts and manages their state.
 * Renders a popover root and no HTML element of its own.
 */
export const Root: typeof DateRangePickerRoot = DateRangePickerRoot;
export namespace Root {
  export type State = DateRangePickerRootState;
  export type Props<Value extends DateValue = DateValue> = DateRangePickerRootProps<Value>;
  export type Value<End extends DateValue = DateValue> = DateRangePickerRootValue<End>;
  export type Granularity = DateRangePickerRootGranularity;
  export type Actions = DateRangePickerRootActions;
  export type ChangeEventReason = DateRangePickerRootChangeEventReason;
  export type ChangeEventDetails = DateRangePickerRootChangeEventDetails;
  export type OpenChangeEventReason = DateRangePickerRootOpenChangeEventReason;
  export type OpenChangeEventDetails = DateRangePickerRootOpenChangeEventDetails;
}

/**
 * The field that shows the first day of the range in segments.
 * Renders a `DateField.Root`, so it has a `<div>` element and a hidden `<input>` beside it.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const StartField: typeof DateRangePickerStartField = DateRangePickerStartField;
export namespace StartField {
  export type State = DateRangePickerStartFieldState;
  export type Props = DateRangePickerStartFieldProps;
}

/**
 * The field that shows the last day of the range in segments.
 * Renders a `DateField.Root`, so it has a `<div>` element and a hidden `<input>` beside it.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const EndField: typeof DateRangePickerEndField = DateRangePickerEndField;
export namespace EndField {
  export type State = DateRangePickerEndFieldState;
  export type Props = DateRangePickerEndFieldProps;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DateRangePickerTrigger = DateRangePickerTrigger;
export namespace Trigger {
  export type State = DateRangePickerTriggerState;
  export type Props = DateRangePickerTriggerProps;
}

/**
 * Positions the popup against the two fields.
 * Renders a `<div>` element.
 */
export const Positioner: typeof DateRangePickerPositioner = DateRangePickerPositioner;
export namespace Positioner {
  export type State = DateRangePickerPositionerState;
  export type Props = DateRangePickerPositionerProps;
}

/**
 * The calendar that selects the range of the picker.
 * Renders a `RangeCalendar.Root`, so it has a `<div>` element.
 */
export const Calendar: typeof DateRangePickerCalendar = DateRangePickerCalendar;
export namespace Calendar {
  export type State = DateRangePickerCalendarState;
  export type Props = DateRangePickerCalendarProps;
}

/**
 * A container for the popup content.
 * Renders a `<div>` element.
 */
export const Popup: typeof DateRangePickerPopup = DateRangePickerPopup;
export namespace Popup {
  export type State = DateRangePickerPopupState;
  export type Props = DateRangePickerPopupProps;
}

export { Arrow, Backdrop, Close, Description, Portal, Title } from '../popover/parts';
