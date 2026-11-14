import MenuArrow from './arrow/MenuArrow.vue';
import type { MenuArrowProps, MenuArrowState } from './arrow/MenuArrow.vue';
import MenuBackdrop from './backdrop/MenuBackdrop.vue';
import type { MenuBackdropProps, MenuBackdropState } from './backdrop/MenuBackdrop.vue';
import MenuGroup from './group/MenuGroup.vue';
import type { MenuGroupProps, MenuGroupState } from './group/MenuGroup.vue';
import MenuGroupLabel from './group-label/MenuGroupLabel.vue';
import type { MenuGroupLabelProps, MenuGroupLabelState } from './group-label/MenuGroupLabel.vue';
import MenuItem from './item/MenuItem.vue';
import type { MenuItemProps, MenuItemState } from './item/MenuItem.vue';
import MenuLinkItem from './link-item/MenuLinkItem.vue';
import type { MenuLinkItemProps, MenuLinkItemState } from './link-item/MenuLinkItem.vue';
import MenuPopup from './popup/MenuPopup.vue';
import type { MenuPopupProps, MenuPopupState } from './popup/MenuPopup.vue';
import MenuPortal from './portal/MenuPortal.vue';
import type { MenuPortalProps, MenuPortalState } from './portal/MenuPortal.vue';
import MenuPositioner from './positioner/MenuPositioner.vue';
import type { MenuPositionerProps, MenuPositionerState } from './positioner/MenuPositioner.vue';
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
