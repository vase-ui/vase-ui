import DateFieldClear from './clear/DateFieldClear.vue';
import type { DateFieldClearProps, DateFieldClearState } from './clear/DateFieldClear.vue';
import DateFieldInput from './input/DateFieldInput.vue';
import type {
  DateFieldInputProps,
  DateFieldInputSegment,
  DateFieldInputState,
} from './input/DateFieldInput.vue';
import DateFieldLiteral from './literal/DateFieldLiteral.vue';
import type { DateFieldLiteralProps, DateFieldLiteralState } from './literal/DateFieldLiteral.vue';
import DateFieldRoot from './root/DateFieldRoot.vue';
import type {
  DateFieldRootChangeEventDetails,
  DateFieldRootChangeEventReason,
  DateFieldRootGranularity,
  DateFieldRootProps,
  DateFieldRootState,
  DateFieldRootValue,
} from './root/DateFieldRoot.vue';
import DateFieldSegment from './segment/DateFieldSegment.vue';
import type { DateFieldSegmentProps, DateFieldSegmentState } from './segment/DateFieldSegment.vue';

/**
 * Groups all date field parts and manages their state.
 * Renders a `<div>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof DateFieldRoot = DateFieldRoot;
export namespace Root {
  export type State = DateFieldRootState;
  export type Props<Value extends DateFieldRootValue = DateFieldRootValue> =
    DateFieldRootProps<Value>;
  export type Value = DateFieldRootValue;
  export type Granularity = DateFieldRootGranularity;
  export type ChangeEventReason = DateFieldRootChangeEventReason;
  export type ChangeEventDetails = DateFieldRootChangeEventDetails;
}

/**
 * Holds the segments of the field, in the layout of the locale.
 * Renders a `<div>` element.
 */
export const Input: typeof DateFieldInput = DateFieldInput;
export namespace Input {
  export type State = DateFieldInputState;
  export type Props = DateFieldInputProps;
  export type Segment = DateFieldInputSegment;
}

/**
 * One part of the date or time that the user edits, such as the month.
 * Renders an `<input>` element with the role `spinbutton`.
 */
export const Segment: typeof DateFieldSegment = DateFieldSegment;
export namespace Segment {
  export type State = DateFieldSegmentState;
  export type Props = DateFieldSegmentProps;
}

/**
 * The text between the segments, the era and the name of the time zone.
 * Renders a `<span>` element.
 */
export const Literal: typeof DateFieldLiteral = DateFieldLiteral;
export namespace Literal {
  export type State = DateFieldLiteralState;
  export type Props = DateFieldLiteralProps;
}

/**
 * A button that empties the field.
 * Renders a `<button>` element.
 */
export const Clear: typeof DateFieldClear = DateFieldClear;
export namespace Clear {
  export type State = DateFieldClearState;
  export type Props = DateFieldClearProps;
}
