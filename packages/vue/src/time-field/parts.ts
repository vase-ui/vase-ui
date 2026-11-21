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
  TimeFieldRootEmits,
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
 * @selector `[data-empty]` No segment has a number.
 * @selector `[data-complete]` Each segment has a number, so the field has a value.
 * @selector `[data-disabled]` The field, its `Field` or a fieldset around it is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-valid]` The field is in a `Field` that is valid.
 * @selector `[data-invalid]` The field is in a `Field` that is invalid.
 * @selector `[data-touched]` The field is in a `Field` that is touched.
 * @selector `[data-dirty]` The field is in a `Field` that is dirty.
 * @selector `[data-filled]` The field is in a `Field` that has a value.
 */
export const Root: typeof TimeFieldRoot = TimeFieldRoot;
export namespace Root {
  export type Props<Value extends TimeFieldRootValue = Temporal.PlainTime> =
    TimeFieldRootProps<Value>;
  export type Emits<Value extends TimeFieldRootValue = Temporal.PlainTime> =
    TimeFieldRootEmits<Value>;
  export type State = TimeFieldRootState;
  export type Value = TimeFieldRootValue;
  export type Granularity = TimeFieldRootGranularity;
  export type ChangeEventReason = TimeFieldRootChangeEventReason;
  export type ChangeEventDetails = TimeFieldRootChangeEventDetails;
}

/**
 * Holds the segments and the literals of the field.
 * Renders a `<div>` element.
 * @selector `[data-empty]` No segment has a number.
 * @selector `[data-complete]` Each segment has a number, so the field has a value.
 * @selector `[data-disabled]` The field, its `Field` or a fieldset around it is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-valid]` The field is in a `Field` that is valid.
 * @selector `[data-invalid]` The field is in a `Field` that is invalid.
 * @selector `[data-touched]` The field is in a `Field` that is touched.
 * @selector `[data-dirty]` The field is in a `Field` that is dirty.
 * @selector `[data-filled]` The field is in a `Field` that has a value.
 */
export const Input: typeof TimeFieldInput = TimeFieldInput;
export namespace Input {
  export type Props = TimeFieldInputProps;
  export type State = TimeFieldInputState;
  export type Segment = TimeFieldInputSegment;
}

/**
 * Edits one unit of the value. Its placeholder is `--`. Its `size` fits its greatest number and
 * its placeholder. Add `field-sizing: content` to its style to make its box follow the text.
 * Renders an `<input>` element.
 * @selector `[data-type]` The unit of the segment: `hour`, `minute`, `second` or `dayPeriod`.
 * @selector `:placeholder-shown` The segment has no number.
 * @selector `[data-empty]` No segment has a number.
 * @selector `[data-complete]` Each segment has a number, so the field has a value.
 * @selector `:disabled` The field, its `Field` or a fieldset around it is disabled.
 * @selector `:read-only` The field is read-only or disabled.
 * @selector `[aria-required="true"]` The field is required.
 * @selector `[aria-invalid="true"]` The field is in a `Field` that is invalid.
 * @selector `[data-valid]` The field is in a `Field` that is valid.
 * @selector `[data-touched]` The field is in a `Field` that is touched.
 * @selector `[data-dirty]` The field is in a `Field` that is dirty.
 * @selector `[data-filled]` The field is in a `Field` that has a value.
 */
export const Segment: typeof TimeFieldSegment = TimeFieldSegment;
export namespace Segment {
  export type Props = TimeFieldSegmentProps;
  export type State = TimeFieldSegmentState;
}

/**
 * Shows a separator or the name of a time zone.
 * Renders a `<span>` element.
 * @selector `[data-type]` The kind of the text: `literal` for a separator, or `timeZoneName`.
 * @selector `[data-empty]` No segment has a number.
 * @selector `[data-complete]` Each segment has a number, so the field has a value.
 * @selector `[data-disabled]` The field, its `Field` or a fieldset around it is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-valid]` The field is in a `Field` that is valid.
 * @selector `[data-invalid]` The field is in a `Field` that is invalid.
 * @selector `[data-touched]` The field is in a `Field` that is touched.
 * @selector `[data-dirty]` The field is in a `Field` that is dirty.
 * @selector `[data-filled]` The field is in a `Field` that has a value.
 */
export const Literal: typeof TimeFieldLiteral = TimeFieldLiteral;
export namespace Literal {
  export type Props = TimeFieldLiteralProps;
  export type State = TimeFieldLiteralState;
}

/**
 * Empties the field and gives the focus to the first segment.
 * Renders a `<button>` element.
 * @selector `:disabled` The button is a native button, and the field is empty, read-only or disabled, or the button has `disabled`.
 * @selector `[aria-disabled="true"]` The button is another element, and the field is empty, read-only or disabled, or the button has `disabled`.
 * @selector `[data-empty]` No segment has a number.
 * @selector `[data-complete]` Each segment has a number, so the field has a value.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-valid]` The field is in a `Field` that is valid.
 * @selector `[data-invalid]` The field is in a `Field` that is invalid.
 * @selector `[data-touched]` The field is in a `Field` that is touched.
 * @selector `[data-dirty]` The field is in a `Field` that is dirty.
 * @selector `[data-filled]` The field is in a `Field` that has a value.
 */
export const Clear: typeof TimeFieldClear = TimeFieldClear;
export namespace Clear {
  export type Props = TimeFieldClearProps;
  export type State = TimeFieldClearState;
}
