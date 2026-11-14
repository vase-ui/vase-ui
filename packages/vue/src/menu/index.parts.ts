import MenuArrow from './arrow/MenuArrow.vue';
import type { MenuArrowProps, MenuArrowState } from './arrow/MenuArrow.vue';
import MenuBackdrop from './backdrop/MenuBackdrop.vue';
import type { MenuBackdropProps, MenuBackdropState } from './backdrop/MenuBackdrop.vue';
import MenuCheckboxItem from './checkbox-item/MenuCheckboxItem.vue';
import type {
  MenuCheckboxItemChangeEventDetails,
  MenuCheckboxItemChangeEventReason,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
} from './checkbox-item/MenuCheckboxItem.vue';
import MenuCheckboxItemIndicator from './checkbox-item-indicator/MenuCheckboxItemIndicator.vue';
import type {
  MenuCheckboxItemIndicatorProps,
  MenuCheckboxItemIndicatorState,
} from './checkbox-item-indicator/MenuCheckboxItemIndicator.vue';
import MenuGroup from './group/MenuGroup.vue';
import type { MenuGroupProps, MenuGroupState } from './group/MenuGroup.vue';
import MenuGroupLabel from './group-label/MenuGroupLabel.vue';
import type { MenuGroupLabelProps, MenuGroupLabelState } from './group-label/MenuGroupLabel.vue';
import MenuItem from './item/MenuItem.vue';
import type { MenuItemProps, MenuItemState } from './item/MenuItem.vue';
import MenuLinkItem from './link-item/MenuLinkItem.vue';
import type { MenuLinkItemProps, MenuLinkItemState } from './link-item/MenuLinkItem.vue';
import MenuList from './list/MenuList.vue';
import type { MenuListProps, MenuListState } from './list/MenuList.vue';
import MenuPopup from './popup/MenuPopup.vue';
import type { MenuPopupProps, MenuPopupState } from './popup/MenuPopup.vue';
import MenuPortal from './portal/MenuPortal.vue';
import type { MenuPortalProps, MenuPortalState } from './portal/MenuPortal.vue';
import MenuPositioner from './positioner/MenuPositioner.vue';
import type { MenuPositionerProps, MenuPositionerState } from './positioner/MenuPositioner.vue';
import MenuRadioGroup from './radio-group/MenuRadioGroup.vue';
import type {
  MenuRadioGroupChangeEventDetails,
  MenuRadioGroupChangeEventReason,
  MenuRadioGroupProps,
  MenuRadioGroupState,
} from './radio-group/MenuRadioGroup.vue';
import MenuRadioItem from './radio-item/MenuRadioItem.vue';
import type { MenuRadioItemProps, MenuRadioItemState } from './radio-item/MenuRadioItem.vue';
import MenuRadioItemIndicator from './radio-item-indicator/MenuRadioItemIndicator.vue';
import type {
  MenuRadioItemIndicatorProps,
  MenuRadioItemIndicatorState,
} from './radio-item-indicator/MenuRadioItemIndicator.vue';
import MenuRoot from './root/MenuRoot.vue';
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootOrientation,
  MenuRootProps,
  MenuRootState,
} from './root/MenuRoot.vue';
import MenuSubmenuRoot from './submenu-root/MenuSubmenuRoot.vue';
import type {
  MenuSubmenuRootChangeEventDetails,
  MenuSubmenuRootChangeEventReason,
  MenuSubmenuRootProps,
  MenuSubmenuRootState,
} from './submenu-root/MenuSubmenuRoot.vue';
import MenuSubmenuTrigger from './submenu-trigger/MenuSubmenuTrigger.vue';
import type {
  MenuSubmenuTriggerProps,
  MenuSubmenuTriggerState,
} from './submenu-trigger/MenuSubmenuTrigger.vue';
import MenuTrigger from './trigger/MenuTrigger.vue';
import type { MenuTriggerProps, MenuTriggerState } from './trigger/MenuTrigger.vue';

/**
 * Displays an element positioned against the menu anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof MenuArrow = MenuArrow;
export namespace Arrow {
  export type State = MenuArrowState;
  export type Props = MenuArrowProps;
}

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof MenuBackdrop = MenuBackdrop;
export namespace Backdrop {
  export type State = MenuBackdropState;
  export type Props = MenuBackdropProps;
}

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 */
export const CheckboxItem: typeof MenuCheckboxItem = MenuCheckboxItem;
export namespace CheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props = MenuCheckboxItemProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}

/**
 * Indicates whether the checkbox item is ticked.
 * Renders a `<span>` element.
 */
export const CheckboxItemIndicator: typeof MenuCheckboxItemIndicator = MenuCheckboxItemIndicator;
export namespace CheckboxItemIndicator {
  export type Props = MenuCheckboxItemIndicatorProps;
  export type State = MenuCheckboxItemIndicatorState;
}

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 */
export const Group: typeof MenuGroup = MenuGroup;
export namespace Group {
  export type Props = MenuGroupProps;
  export type State = MenuGroupState;
}

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof MenuGroupLabel = MenuGroupLabel;
export namespace GroupLabel {
  export type Props = MenuGroupLabelProps;
  export type State = MenuGroupLabelState;
}

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 */
export const Item: typeof MenuItem = MenuItem;
export namespace Item {
  export type State = MenuItemState;
  export type Props = MenuItemProps;
}

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 */
export const LinkItem: typeof MenuLinkItem = MenuLinkItem;
export namespace LinkItem {
  export type State = MenuLinkItemState;
  export type Props = MenuLinkItemProps;
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 */
export const List: typeof MenuList = MenuList;
export namespace List {
  export type Props = MenuListProps;
  export type State = MenuListState;
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 */
export const Popup: typeof MenuPopup = MenuPopup;
export namespace Popup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof MenuPortal = MenuPortal;
export namespace Portal {
  export type State = MenuPortalState;
  export type Props = MenuPortalProps;
}

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof MenuPositioner = MenuPositioner;
export namespace Positioner {
  export type State = MenuPositionerState;
  export type Props = MenuPositionerProps;
}

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 */
export const RadioGroup: typeof MenuRadioGroup = MenuRadioGroup;
export namespace RadioGroup {
  export type Props = MenuRadioGroupProps;
  export type State = MenuRadioGroupState;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 */
export const RadioItem: typeof MenuRadioItem = MenuRadioItem;
export namespace RadioItem {
  export type State = MenuRadioItemState;
  export type Props = MenuRadioItemProps;
}

/**
 * Indicates whether the radio item is selected.
 * Renders a `<span>` element.
 */
export const RadioItemIndicator: typeof MenuRadioItemIndicator = MenuRadioItemIndicator;
export namespace RadioItemIndicator {
  export type Props = MenuRadioItemIndicatorProps;
  export type State = MenuRadioItemIndicatorState;
}

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 */
export const Root: typeof MenuRoot = MenuRoot;
export namespace Root {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}

/**
 * Groups all parts of a submenu.
 * Doesn't render its own HTML element.
 */
export const SubmenuRoot: typeof MenuSubmenuRoot = MenuSubmenuRoot;
export namespace SubmenuRoot {
  export type Props = MenuSubmenuRootProps;
  export type State = MenuSubmenuRootState;
  export type ChangeEventReason = MenuSubmenuRootChangeEventReason;
  export type ChangeEventDetails = MenuSubmenuRootChangeEventDetails;
}

/**
 * A menu item that opens a submenu.
 * Renders a `<div>` element.
 */
export const SubmenuTrigger: typeof MenuSubmenuTrigger = MenuSubmenuTrigger;
export namespace SubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 */
export const Trigger: typeof MenuTrigger = MenuTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}

export { Separator } from '../separator';
export { MenuHandle as Handle, createMenuHandle as createHandle } from './store/MenuHandle';
