import DateFieldClear from './DateFieldClear.vue';
import DateFieldInput from './DateFieldInput.vue';
import DateFieldLiteral from './DateFieldLiteral.vue';
import DateFieldRoot from './DateFieldRoot.vue';
import DateFieldSegment from './DateFieldSegment.vue';
import type {
  DateFieldClearProps,
  DateFieldClearState,
  DateFieldInputProps,
  DateFieldInputSegment,
  DateFieldInputState,
  DateFieldLiteralProps,
  DateFieldLiteralState,
  DateFieldRootChangeEventDetails,
  DateFieldRootChangeEventReason,
  DateFieldRootGranularity,
  DateFieldRootProps,
  DateFieldRootState,
  DateFieldRootValue,
  DateFieldSegmentProps,
  DateFieldSegmentState,
} from './types';

/**
 * Groups the parts of a date field and holds its value.
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
export const Root: typeof DateFieldRoot = DateFieldRoot;
export namespace Root {
  export type Props<Value extends DateFieldRootValue = DateFieldRootValue> =
    DateFieldRootProps<Value>;
  export type State = DateFieldRootState;
  export type Value = DateFieldRootValue;
  export type Granularity = DateFieldRootGranularity;
  export type ChangeEventReason = DateFieldRootChangeEventReason;
  export type ChangeEventDetails = DateFieldRootChangeEventDetails;
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
export const Input: typeof DateFieldInput = DateFieldInput;
export namespace Input {
  export type Props = DateFieldInputProps;
  export type State = DateFieldInputState;
  export type Segment = DateFieldInputSegment;
}

/**
 * Edits one unit of the value. Its placeholder is the short name of a date unit, such as `mo` in
 * `en-US`, else `--`. Its `size` fits its greatest number and its placeholder. Add
 * `field-sizing: content` to its style to make its box follow the text.
 * Renders an `<input>` element.
 * @selector `[data-type]` The unit of the segment: `year`, `month`, `day`, `hour`, `minute`, `second` or `dayPeriod`.
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
export const Segment: typeof DateFieldSegment = DateFieldSegment;
export namespace Segment {
  export type Props = DateFieldSegmentProps;
  export type State = DateFieldSegmentState;
}

/**
 * Shows a separator, an era or the name of a time zone.
 * Renders a `<span>` element.
 * @selector `[data-type]` The kind of the text: `literal` for a separator, `era` or `timeZoneName`.
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
export const Literal: typeof DateFieldLiteral = DateFieldLiteral;
export namespace Literal {
  export type Props = DateFieldLiteralProps;
  export type State = DateFieldLiteralState;
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
export const Clear: typeof DateFieldClear = DateFieldClear;
export namespace Clear {
  export type Props = DateFieldClearProps;
  export type State = DateFieldClearState;
}
