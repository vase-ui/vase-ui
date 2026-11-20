import NumberFieldDecrement from './NumberFieldDecrement.vue';
import NumberFieldGroup from './NumberFieldGroup.vue';
import NumberFieldIncrement from './NumberFieldIncrement.vue';
import NumberFieldInput from './NumberFieldInput.vue';
import NumberFieldRoot from './NumberFieldRoot.vue';
import NumberFieldScrubArea from './NumberFieldScrubArea.vue';
import type {
  NumberFieldDecrementProps,
  NumberFieldDecrementState,
  NumberFieldGroupProps,
  NumberFieldGroupState,
  NumberFieldIncrementProps,
  NumberFieldIncrementState,
  NumberFieldInputProps,
  NumberFieldInputState,
  NumberFieldRootChangeEventDetails,
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootCommitEventReason,
  NumberFieldRootProps,
  NumberFieldRootState,
  NumberFieldScrubAreaProps,
  NumberFieldScrubAreaState,
} from './types';

export const Root: typeof NumberFieldRoot = NumberFieldRoot;
export namespace Root {
  export type Props = NumberFieldRootProps;
  export type State = NumberFieldRootState;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}

export const Group: typeof NumberFieldGroup = NumberFieldGroup;
export namespace Group {
  export type Props = NumberFieldGroupProps;
  export type State = NumberFieldGroupState;
}

export const Input: typeof NumberFieldInput = NumberFieldInput;
export namespace Input {
  export type Props = NumberFieldInputProps;
  export type State = NumberFieldInputState;
}

export const Increment: typeof NumberFieldIncrement = NumberFieldIncrement;
export namespace Increment {
  export type Props = NumberFieldIncrementProps;
  export type State = NumberFieldIncrementState;
}

export const Decrement: typeof NumberFieldDecrement = NumberFieldDecrement;
export namespace Decrement {
  export type Props = NumberFieldDecrementProps;
  export type State = NumberFieldDecrementState;
}

export const ScrubArea: typeof NumberFieldScrubArea = NumberFieldScrubArea;
export namespace ScrubArea {
  export type Props = NumberFieldScrubAreaProps;
  export type State = NumberFieldScrubAreaState;
}
