import NavigationMenuArrow from './NavigationMenuArrow.vue';
import NavigationMenuBackdrop from './NavigationMenuBackdrop.vue';
import NavigationMenuContent from './NavigationMenuContent.vue';
import NavigationMenuIcon from './NavigationMenuIcon.vue';
import NavigationMenuItem from './NavigationMenuItem.vue';
import NavigationMenuLink from './NavigationMenuLink.vue';
import NavigationMenuList from './NavigationMenuList.vue';
import NavigationMenuPopup from './NavigationMenuPopup.vue';
import NavigationMenuPortal from './NavigationMenuPortal.vue';
import NavigationMenuPositioner from './NavigationMenuPositioner.vue';
import NavigationMenuRoot from './NavigationMenuRoot.vue';
import NavigationMenuTrigger from './NavigationMenuTrigger.vue';
import NavigationMenuViewport from './NavigationMenuViewport.vue';
import type {
  NavigationMenuArrowProps,
  NavigationMenuArrowState,
  NavigationMenuBackdropProps,
  NavigationMenuBackdropState,
  NavigationMenuContentProps,
  NavigationMenuContentState,
  NavigationMenuIconProps,
  NavigationMenuIconState,
  NavigationMenuItemProps,
  NavigationMenuItemState,
  NavigationMenuLinkProps,
  NavigationMenuLinkState,
  NavigationMenuListProps,
  NavigationMenuListState,
  NavigationMenuPopupProps,
  NavigationMenuPopupState,
  NavigationMenuPortalProps,
  NavigationMenuPortalState,
  NavigationMenuPositionerProps,
  NavigationMenuPositionerState,
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootChangeEventReason,
  NavigationMenuRootProps,
  NavigationMenuRootState,
  NavigationMenuRootValue,
  NavigationMenuTriggerProps,
  NavigationMenuTriggerState,
  NavigationMenuViewportProps,
  NavigationMenuViewportState,
} from './types';

/**
 * Groups the parts of the navigation menu.
 * Renders a `<nav>` element, and a `<div>` in a navigation menu.
 */
export const Root: typeof NavigationMenuRoot = NavigationMenuRoot;
export namespace Root {
  export type Props<Value = NavigationMenuRootValue> = NavigationMenuRootProps<Value>;
  export type State = NavigationMenuRootState;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}

/**
 * The list of the items.
 * Renders a `<ul>` element.
 */
export const List: typeof NavigationMenuList = NavigationMenuList;
export namespace List {
  export type Props = NavigationMenuListProps;
  export type State = NavigationMenuListState;
}

/**
 * An item of the list: a trigger with its content, or a link.
 * Renders an `<li>` element.
 */
export const Item: typeof NavigationMenuItem = NavigationMenuItem;
export namespace Item {
  export type Props<Value = NavigationMenuRootValue> = NavigationMenuItemProps<Value>;
  export type State = NavigationMenuItemState;
}

/**
 * A button that opens the content of its item.
 * Renders a `<button>` element.
 */
export const Trigger: typeof NavigationMenuTrigger = NavigationMenuTrigger;
export namespace Trigger {
  export type Props = NavigationMenuTriggerProps;
  export type State = NavigationMenuTriggerState;
}

/**
 * An icon of the open state of the item.
 * Renders a `<span>` element.
 */
export const Icon: typeof NavigationMenuIcon = NavigationMenuIcon;
export namespace Icon {
  export type Props = NavigationMenuIconProps;
  export type State = NavigationMenuIconState;
}

/**
 * The content of the item. It shows in the viewport.
 * Renders a `<div>` element.
 */
export const Content: typeof NavigationMenuContent = NavigationMenuContent;
export namespace Content {
  export type Props = NavigationMenuContentProps;
  export type State = NavigationMenuContentState;
}

/**
 * A link in the list or in a content.
 * Renders an `<a>` element.
 */
export const Link: typeof NavigationMenuLink = NavigationMenuLink;
export namespace Link {
  export type Props = NavigationMenuLinkProps;
  export type State = NavigationMenuLinkState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof NavigationMenuPortal = NavigationMenuPortal;
export namespace Portal {
  export type Props = NavigationMenuPortalProps;
  export type State = NavigationMenuPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof NavigationMenuBackdrop = NavigationMenuBackdrop;
export namespace Backdrop {
  export type Props = NavigationMenuBackdropProps;
  export type State = NavigationMenuBackdropState;
}

/**
 * Places the popup at the active trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof NavigationMenuPositioner = NavigationMenuPositioner;
export namespace Positioner {
  export type Props = NavigationMenuPositionerProps;
  export type State = NavigationMenuPositionerState;
}

/**
 * The container of the viewport.
 * Renders a `<nav>` element.
 */
export const Popup: typeof NavigationMenuPopup = NavigationMenuPopup;
export namespace Popup {
  export type Props = NavigationMenuPopupProps;
  export type State = NavigationMenuPopupState;
}

/**
 * An element that points to the active trigger.
 * Renders a `<div>` element.
 */
export const Arrow: typeof NavigationMenuArrow = NavigationMenuArrow;
export namespace Arrow {
  export type Props = NavigationMenuArrowProps;
  export type State = NavigationMenuArrowState;
}

/**
 * The place where the content of the open item shows.
 * Renders a `<div>` element.
 */
export const Viewport: typeof NavigationMenuViewport = NavigationMenuViewport;
export namespace Viewport {
  export type Props = NavigationMenuViewportProps;
  export type State = NavigationMenuViewportState;
}
