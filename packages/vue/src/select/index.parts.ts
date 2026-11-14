import SelectIcon from './icon/SelectIcon.vue';
import type { SelectIconProps, SelectIconState } from './icon/SelectIcon.vue';
import SelectLabel from './label/SelectLabel.vue';
import type { SelectLabelProps, SelectLabelState } from './label/SelectLabel.vue';
import SelectRoot from './root/SelectRoot.vue';
import type {
  SelectRootActions,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootOpenChangeEventDetails,
  SelectRootProps,
  SelectRootState,
} from './root/SelectRoot.vue';
import SelectTrigger from './trigger/SelectTrigger.vue';
import type { SelectTriggerProps, SelectTriggerState } from './trigger/SelectTrigger.vue';
import SelectValue from './value/SelectValue.vue';
import type { SelectValueProps, SelectValueState } from './value/SelectValue.vue';

/**
 * Groups all parts of the select.
 * Doesn't render its own HTML element.
 */
export const Root: typeof SelectRoot = SelectRoot;
export namespace Root {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
  export type OpenChangeEventDetails = SelectRootOpenChangeEventDetails;
}

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 */
export const Label: typeof SelectLabel = SelectLabel;
export namespace Label {
  export type Props = SelectLabelProps;
  export type State = SelectLabelState;
}

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof SelectTrigger = SelectTrigger;
export namespace Trigger {
  export type Props<Value = any> = SelectTriggerProps<Value>;
  export type State<Value = any> = SelectTriggerState<Value>;
}

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 */
export const Value: typeof SelectValue = SelectValue;
export namespace Value {
  export type Props = SelectValueProps;
  export type State = SelectValueState;
}

/**
 * An icon that indicates that the trigger button opens a select popup.
 * Renders a `<span>` element.
 */
export const Icon: typeof SelectIcon = SelectIcon;
export namespace Icon {
  export type Props = SelectIconProps;
  export type State = SelectIconState;
}
