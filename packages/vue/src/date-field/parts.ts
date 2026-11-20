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

export const Input: typeof DateFieldInput = DateFieldInput;
export namespace Input {
  export type Props = DateFieldInputProps;
  export type State = DateFieldInputState;
  export type Segment = DateFieldInputSegment;
}

export const Segment: typeof DateFieldSegment = DateFieldSegment;
export namespace Segment {
  export type Props = DateFieldSegmentProps;
  export type State = DateFieldSegmentState;
}

export const Literal: typeof DateFieldLiteral = DateFieldLiteral;
export namespace Literal {
  export type Props = DateFieldLiteralProps;
  export type State = DateFieldLiteralState;
}

export const Clear: typeof DateFieldClear = DateFieldClear;
export namespace Clear {
  export type Props = DateFieldClearProps;
  export type State = DateFieldClearState;
}
