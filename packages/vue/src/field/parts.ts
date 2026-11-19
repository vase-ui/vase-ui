import FieldDescription from './FieldDescription.vue';
import FieldError from './FieldError.vue';
import FieldItem from './FieldItem.vue';
import FieldLabel from './FieldLabel.vue';
import FieldRoot from './FieldRoot.vue';
import type {
  FieldDescriptionProps,
  FieldDescriptionState,
  FieldErrorProps,
  FieldErrorState,
  FieldItemProps,
  FieldItemState,
  FieldLabelProps,
  FieldLabelState,
  FieldRootProps,
  FieldRootState,
} from './types';

export const Root: typeof FieldRoot = FieldRoot;
export namespace Root {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
}

export const Label: typeof FieldLabel = FieldLabel;
export namespace Label {
  export type Props = FieldLabelProps;
  export type State = FieldLabelState;
}

export const Description: typeof FieldDescription = FieldDescription;
export namespace Description {
  export type Props = FieldDescriptionProps;
  export type State = FieldDescriptionState;
}

export const Error: typeof FieldError = FieldError;
export namespace Error {
  export type Props = FieldErrorProps;
  export type State = FieldErrorState;
}

export const Item: typeof FieldItem = FieldItem;
export namespace Item {
  export type Props = FieldItemProps;
  export type State = FieldItemState;
}
