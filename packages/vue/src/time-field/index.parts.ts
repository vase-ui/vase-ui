import type { TimeValue } from '../internals/date-time/temporal';
import TimeFieldClear from './clear/TimeFieldClear.vue';
import type { TimeFieldClearProps, TimeFieldClearState } from './clear/TimeFieldClear.vue';
import TimeFieldInput from './input/TimeFieldInput.vue';
import type {
  TimeFieldInputProps,
  TimeFieldInputSegment,
  TimeFieldInputState,
} from './input/TimeFieldInput.vue';
import TimeFieldLiteral from './literal/TimeFieldLiteral.vue';
import type { TimeFieldLiteralProps, TimeFieldLiteralState } from './literal/TimeFieldLiteral.vue';
import TimeFieldRoot from './root/TimeFieldRoot.vue';
import type {
  TimeFieldRootActions,
  TimeFieldRootChangeEventDetails,
  TimeFieldRootChangeEventReason,
  TimeFieldRootGranularity,
  TimeFieldRootProps,
  TimeFieldRootState,
} from './root/TimeFieldRoot.vue';
import TimeFieldSegment from './segment/TimeFieldSegment.vue';
import type { TimeFieldSegmentProps, TimeFieldSegmentState } from './segment/TimeFieldSegment.vue';

/**
 * Groups all time field parts and manages their state.
 * Renders a `<div>` element with `role="group"` and a hidden `<input>` after it.
 *
 * The hidden input holds the value for a form. The part has more than one root node. A rule of
 * `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof TimeFieldRoot = TimeFieldRoot;
export namespace Root {
  export type State = TimeFieldRootState;
  export type Props<Value extends TimeValue = Temporal.PlainTime> = TimeFieldRootProps<Value>;
  export type Granularity = TimeFieldRootGranularity;
  export type Actions = TimeFieldRootActions;
  export type ChangeEventReason = TimeFieldRootChangeEventReason;
  export type ChangeEventDetails = TimeFieldRootChangeEventDetails;
}

/**
 * Holds the segments and the text between them, in the layout of the locale.
 * Renders a `<div>` element.
 */
export const Input: typeof TimeFieldInput = TimeFieldInput;
export namespace Input {
  export type State = TimeFieldInputState;
  export type Props = TimeFieldInputProps;
  export type Segment = TimeFieldInputSegment;
}

/**
 * An editable segment of the time: the hour, the minute, the second or the day period.
 * Renders an `<input>` element with `role="spinbutton"`.
 */
export const Segment: typeof TimeFieldSegment = TimeFieldSegment;
export namespace Segment {
  export type State = TimeFieldSegmentState;
  export type Props = TimeFieldSegmentProps;
}

/**
 * The text between two segments, or the name of the time zone of the value.
 * Renders a `<span>` element.
 */
export const Literal: typeof TimeFieldLiteral = TimeFieldLiteral;
export namespace Literal {
  export type State = TimeFieldLiteralState;
  export type Props = TimeFieldLiteralProps;
}

/**
 * A button that empties the field.
 * Renders a `<button>` element.
 */
export const Clear: typeof TimeFieldClear = TimeFieldClear;
export namespace Clear {
  export type State = TimeFieldClearState;
  export type Props = TimeFieldClearProps;
}
