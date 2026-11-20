import SelectRoot from './SelectRoot.vue';
import SelectLabel from './SelectLabel.vue';
import SelectTrigger from './SelectTrigger.vue';
import SelectValue from './SelectValue.vue';
import SelectIcon from './SelectIcon.vue';
import SelectPortal from './SelectPortal.vue';
import SelectBackdrop from './SelectBackdrop.vue';
import SelectPositioner from './SelectPositioner.vue';
import SelectPopup from './SelectPopup.vue';
import SelectArrow from './SelectArrow.vue';
import SelectList from './SelectList.vue';
import SelectItem from './SelectItem.vue';
import SelectItemText from './SelectItemText.vue';
import SelectGroup from './SelectGroup.vue';
import SelectGroupLabel from './SelectGroupLabel.vue';
import SelectSeparator from './SelectSeparator.vue';
import SelectScrollUpArrow from './SelectScrollUpArrow.vue';
import SelectScrollDownArrow from './SelectScrollDownArrow.vue';
import type {
  SelectArrowProps,
  SelectArrowState,
  SelectBackdropProps,
  SelectBackdropState,
  SelectGroupLabelProps,
  SelectGroupLabelState,
  SelectGroupProps,
  SelectGroupState,
  SelectIconProps,
  SelectIconState,
  SelectItemProps,
  SelectItemState,
  SelectItemTextProps,
  SelectItemTextState,
  SelectLabelProps,
  SelectLabelState,
  SelectListProps,
  SelectListState,
  SelectPopupProps,
  SelectPopupState,
  SelectPortalProps,
  SelectPortalState,
  SelectPositionerProps,
  SelectPositionerState,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootOpenChangeEventDetails,
  SelectRootOpenChangeEventReason,
  SelectRootProps,
  SelectRootState,
  SelectScrollDownArrowProps,
  SelectScrollDownArrowState,
  SelectScrollUpArrowProps,
  SelectScrollUpArrowState,
  SelectSeparatorProps,
  SelectSeparatorState,
  SelectTriggerProps,
  SelectTriggerState,
  SelectValueProps,
  SelectValueState,
} from './types';

/**
 * Groups the parts of the select, and holds its value and its form inputs.
 * Renders a `<div>` element.
 */
export const Root: typeof SelectRoot = SelectRoot;
export namespace Root {
  export type Props<Value = any, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
  export type OpenChangeEventReason = SelectRootOpenChangeEventReason;
  export type OpenChangeEventDetails = SelectRootOpenChangeEventDetails;
}

/**
 * A label that names the select. A click gives the focus to the trigger.
 * Renders a `<div>` element.
 */
export const Label: typeof SelectLabel = SelectLabel;
export namespace Label {
  export type Props = SelectLabelProps;
  export type State = SelectLabelState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof SelectTrigger = SelectTrigger;
export namespace Trigger {
  export type Props = SelectTriggerProps;
  export type State<Value = any> = SelectTriggerState<Value>;
}

/**
 * The text of the value, or the placeholder.
 * Renders a `<span>` element.
 */
export const Value: typeof SelectValue = SelectValue;
export namespace Value {
  export type Props = SelectValueProps;
  export type State<Value = any> = SelectValueState<Value>;
}

/**
 * An icon that shows the select opens a list.
 * Renders a `<span>` element.
 */
export const Icon: typeof SelectIcon = SelectIcon;
export namespace Icon {
  export type Props = SelectIconProps;
  export type State = SelectIconState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof SelectPortal = SelectPortal;
export namespace Portal {
  export type Props = SelectPortalProps;
  export type State = SelectPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof SelectBackdrop = SelectBackdrop;
export namespace Backdrop {
  export type Props = SelectBackdropProps;
  export type State = SelectBackdropState;
}

/**
 * Places the popup at the trigger, or over it.
 * Renders a `<div>` element.
 */
export const Positioner: typeof SelectPositioner = SelectPositioner;
export namespace Positioner {
  export type Props = SelectPositionerProps;
  export type State = SelectPositionerState;
}

/**
 * The container of the items.
 * Renders a `<div>` element.
 */
export const Popup: typeof SelectPopup = SelectPopup;
export namespace Popup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

/**
 * An element that points to the trigger.
 * Renders a `<div>` element.
 */
export const Arrow: typeof SelectArrow = SelectArrow;
export namespace Arrow {
  export type Props = SelectArrowProps;
  export type State = SelectArrowState;
}

/**
 * The element that holds the items and scrolls.
 * Renders a `<div>` element.
 */
export const List: typeof SelectList = SelectList;
export namespace List {
  export type Props = SelectListProps;
  export type State = SelectListState;
}

/**
 * An option that the user can select.
 * Renders a `<div>` element.
 */
export const Item: typeof SelectItem = SelectItem;
export namespace Item {
  export type Props = SelectItemProps;
  export type State = SelectItemState;
}

/**
 * The text of an item, which the popup puts over the value.
 * Renders a `<div>` element.
 */
export const ItemText: typeof SelectItemText = SelectItemText;
export namespace ItemText {
  export type Props = SelectItemTextProps;
  export type State = SelectItemTextState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
 */
export const Group: typeof SelectGroup = SelectGroup;
export namespace Group {
  export type Props = SelectGroupProps;
  export type State = SelectGroupState;
}

/**
 * A label that names a group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof SelectGroupLabel = SelectGroupLabel;
export namespace GroupLabel {
  export type Props = SelectGroupLabelProps;
  export type State = SelectGroupLabelState;
}

/**
 * Separates groups of items.
 * Renders a `<div>` element.
 */
export const Separator: typeof SelectSeparator = SelectSeparator;
export namespace Separator {
  export type Props = SelectSeparatorProps;
  export type State = SelectSeparatorState;
}

/**
 * Scrolls the list up while the pointer moves on it.
 * Renders a `<div>` element.
 */
export const ScrollUpArrow: typeof SelectScrollUpArrow = SelectScrollUpArrow;
export namespace ScrollUpArrow {
  export type Props = SelectScrollUpArrowProps;
  export type State = SelectScrollUpArrowState;
}

/**
 * Scrolls the list down while the pointer moves on it.
 * Renders a `<div>` element.
 */
export const ScrollDownArrow: typeof SelectScrollDownArrow = SelectScrollDownArrow;
export namespace ScrollDownArrow {
  export type Props = SelectScrollDownArrowProps;
  export type State = SelectScrollDownArrowState;
}
