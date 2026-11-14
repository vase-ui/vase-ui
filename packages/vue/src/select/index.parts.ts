import SelectArrow from './arrow/SelectArrow.vue';
import type { SelectArrowProps, SelectArrowState } from './arrow/SelectArrow.vue';
import SelectBackdrop from './backdrop/SelectBackdrop.vue';
import type { SelectBackdropProps, SelectBackdropState } from './backdrop/SelectBackdrop.vue';
import SelectGroupLabel from './group-label/SelectGroupLabel.vue';
import type {
  SelectGroupLabelProps,
  SelectGroupLabelState,
} from './group-label/SelectGroupLabel.vue';
import SelectGroup from './group/SelectGroup.vue';
import type { SelectGroupProps, SelectGroupState } from './group/SelectGroup.vue';
import SelectIcon from './icon/SelectIcon.vue';
import type { SelectIconProps, SelectIconState } from './icon/SelectIcon.vue';
import SelectItemIndicator from './item-indicator/SelectItemIndicator.vue';
import type {
  SelectItemIndicatorProps,
  SelectItemIndicatorState,
} from './item-indicator/SelectItemIndicator.vue';
import SelectItemText from './item-text/SelectItemText.vue';
import type { SelectItemTextProps, SelectItemTextState } from './item-text/SelectItemText.vue';
import SelectItem from './item/SelectItem.vue';
import type { SelectItemProps, SelectItemState } from './item/SelectItem.vue';
import SelectLabel from './label/SelectLabel.vue';
import type { SelectLabelProps, SelectLabelState } from './label/SelectLabel.vue';
import SelectList from './list/SelectList.vue';
import type { SelectListProps, SelectListState } from './list/SelectList.vue';
import SelectPopup from './popup/SelectPopup.vue';
import type { SelectPopupProps, SelectPopupState } from './popup/SelectPopup.vue';
import SelectPortal from './portal/SelectPortal.vue';
import type { SelectPortalProps, SelectPortalState } from './portal/SelectPortal.vue';
import SelectPositioner from './positioner/SelectPositioner.vue';
import type {
  SelectPositionerProps,
  SelectPositionerState,
} from './positioner/SelectPositioner.vue';
import SelectRoot from './root/SelectRoot.vue';
import type {
  SelectRootActions,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootOpenChangeEventDetails,
  SelectRootProps,
  SelectRootState,
} from './root/SelectRoot.vue';
import SelectScrollDownArrow from './scroll-down-arrow/SelectScrollDownArrow.vue';
import type {
  SelectScrollDownArrowProps,
  SelectScrollDownArrowState,
} from './scroll-down-arrow/SelectScrollDownArrow.vue';
import SelectScrollUpArrow from './scroll-up-arrow/SelectScrollUpArrow.vue';
import type {
  SelectScrollUpArrowProps,
  SelectScrollUpArrowState,
} from './scroll-up-arrow/SelectScrollUpArrow.vue';
import SelectSeparator from './separator/SelectSeparator.vue';
import type { SelectSeparatorProps, SelectSeparatorState } from './separator/SelectSeparator.vue';
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

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof SelectPortal = SelectPortal;
export namespace Portal {
  export type Props = SelectPortalProps;
  export type State = SelectPortalState;
}

/**
 * An overlay displayed beneath the select popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof SelectBackdrop = SelectBackdrop;
export namespace Backdrop {
  export type Props = SelectBackdropProps;
  export type State = SelectBackdropState;
}

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 */
export const Positioner: typeof SelectPositioner = SelectPositioner;
export namespace Positioner {
  export type Props = SelectPositionerProps;
  export type State = SelectPositionerState;
}

/**
 * A container for the select list.
 * Renders a `<div>` element.
 */
export const Popup: typeof SelectPopup = SelectPopup;
export namespace Popup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

/**
 * A container for the select items.
 * Renders a `<div>` element.
 */
export const List: typeof SelectList = SelectList;
export namespace List {
  export type Props = SelectListProps;
  export type State = SelectListState;
}

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 */
export const Item: typeof SelectItem = SelectItem;
export namespace Item {
  export type Props = SelectItemProps;
  export type State = SelectItemState;
}

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 */
export const ItemIndicator: typeof SelectItemIndicator = SelectItemIndicator;
export namespace ItemIndicator {
  export type Props = SelectItemIndicatorProps;
  export type State = SelectItemIndicatorState;
}

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 */
export const ItemText: typeof SelectItemText = SelectItemText;
export namespace ItemText {
  export type Props = SelectItemTextProps;
  export type State = SelectItemTextState;
}

/**
 * Displays an element positioned against the select popup anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof SelectArrow = SelectArrow;
export namespace Arrow {
  export type Props = SelectArrowProps;
  export type State = SelectArrowState;
}

/**
 * An element that scrolls the select popup down when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 */
export const ScrollDownArrow: typeof SelectScrollDownArrow = SelectScrollDownArrow;
export namespace ScrollDownArrow {
  export type Props = SelectScrollDownArrowProps;
  export type State = SelectScrollDownArrowState;
}

/**
 * An element that scrolls the select popup up when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 */
export const ScrollUpArrow: typeof SelectScrollUpArrow = SelectScrollUpArrow;
export namespace ScrollUpArrow {
  export type Props = SelectScrollUpArrowProps;
  export type State = SelectScrollUpArrowState;
}

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 */
export const Group: typeof SelectGroup = SelectGroup;
export namespace Group {
  export type Props = SelectGroupProps;
  export type State = SelectGroupState;
}

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof SelectGroupLabel = SelectGroupLabel;
export namespace GroupLabel {
  export type Props = SelectGroupLabelProps;
  export type State = SelectGroupLabelState;
}

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 */
export const Separator: typeof SelectSeparator = SelectSeparator;
export namespace Separator {
  export type Props = SelectSeparatorProps;
  export type State = SelectSeparatorState;
}
