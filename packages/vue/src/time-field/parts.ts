import TimeFieldClear from './TimeFieldClear.vue';
import TimeFieldInput from './TimeFieldInput.vue';
import TimeFieldLiteral from './TimeFieldLiteral.vue';
import TimeFieldRoot from './TimeFieldRoot.vue';
import TimeFieldSegment from './TimeFieldSegment.vue';
import type {
  TimeFieldClearProps,
  TimeFieldClearState,
  TimeFieldInputProps,
  TimeFieldInputSegment,
  TimeFieldInputState,
  TimeFieldLiteralProps,
  TimeFieldLiteralState,
  TimeFieldRootChangeEventDetails,
  TimeFieldRootChangeEventReason,
  TimeFieldRootGranularity,
  TimeFieldRootProps,
  TimeFieldRootState,
  TimeFieldRootValue,
  TimeFieldSegmentProps,
  TimeFieldSegmentState,
} from './types';

/**
 * Groups the parts of a time field and holds its value.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 */
export const Root: typeof TimeFieldRoot = TimeFieldRoot;
export namespace Root {
  export type Props<Value extends TimeFieldRootValue = Temporal.PlainTime> =
    TimeFieldRootProps<Value>;
  export type State = TimeFieldRootState;
  export type Value = TimeFieldRootValue;
  export type Granularity = TimeFieldRootGranularity;
  export type ChangeEventReason = TimeFieldRootChangeEventReason;
  export type ChangeEventDetails = TimeFieldRootChangeEventDetails;
}

/**
 * Holds the segments and the literals of the field.
 * Renders a `<div>` element.
 */
export const Input: typeof TimeFieldInput = TimeFieldInput;
export namespace Input {
  export type Props = TimeFieldInputProps;
  export type State = TimeFieldInputState;
  export type Segment = TimeFieldInputSegment;
}

/**
 * Edits one unit of the value.
 * Renders an `<input>` element.
 */
export const Segment: typeof TimeFieldSegment = TimeFieldSegment;
export namespace Segment {
  export type Props = TimeFieldSegmentProps;
  export type State = TimeFieldSegmentState;
}

/**
 * Shows a separator or the name of a time zone.
 * Renders a `<span>` element.
 */
export const Literal: typeof TimeFieldLiteral = TimeFieldLiteral;
export namespace Literal {
  export type Props = TimeFieldLiteralProps;
  export type State = TimeFieldLiteralState;
}

/**
 * Empties the field.
 * Renders a `<button>` element.
 */
export const Clear: typeof TimeFieldClear = TimeFieldClear;
export namespace Clear {
  export type Props = TimeFieldClearProps;
  export type State = TimeFieldClearState;
}
