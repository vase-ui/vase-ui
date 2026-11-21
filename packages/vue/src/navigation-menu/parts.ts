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
  NavigationMenuRootEmits,
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
  export type Emits<Value = NavigationMenuRootValue> = NavigationMenuRootEmits<Value>;
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
 * @selector `[aria-expanded="true"]` The item of the trigger is open.
 * @selector `[aria-disabled="true"]` The trigger is disabled. It keeps the focus.
 * @selector `:disabled` The trigger is a native button in a disabled fieldset.
 */
export const Trigger: typeof NavigationMenuTrigger = NavigationMenuTrigger;
export namespace Trigger {
  export type Props = NavigationMenuTriggerProps;
  export type State = NavigationMenuTriggerState;
}

/**
 * An icon of the open state of the item.
 * Renders a `<span>` element.
 * @selector `[data-popup-open]` The item of the icon is open.
 */
export const Icon: typeof NavigationMenuIcon = NavigationMenuIcon;
export namespace Icon {
  export type Props = NavigationMenuIconProps;
  export type State = NavigationMenuIconState;
}

/**
 * The content of the item. It shows in the viewport. Its root is a `<Teleport>`, so a scoped style
 * of the parent does not reach its element: use a CSS module class, `:deep()` or the `element` slot.
 * Renders a `<div>` element.
 * @selector `[data-activation-direction]` The side of the new trigger from the old one at the last change of the item: `left`, `right`, `up` or `down`.
 * @selector `[hidden]` The item is closed, and `keepMounted` keeps the content in the DOM.
 */
export const Content: typeof NavigationMenuContent = NavigationMenuContent;
export namespace Content {
  export type Props = NavigationMenuContentProps;
  export type State = NavigationMenuContentState;
}

/**
 * A link in the list or in a content.
 * Renders an `<a>` element.
 * @selector `[aria-current="page"]` The link goes to the current page. Give the link this attribute.
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
 * @selector `[hidden]` The menu is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 */
export const Backdrop: typeof NavigationMenuBackdrop = NavigationMenuBackdrop;
export namespace Backdrop {
  export type Props = NavigationMenuBackdropProps;
  export type State = NavigationMenuBackdropState;
}

/**
 * Places the popup at the active trigger.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the trigger that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`. A logical side shows only when the `side` prop is logical.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The trigger is out of view.
 * @selector `[data-instant]` An animation should not run: the popup takes its first place at an open, or the window changes its size.
 * @selector `[hidden]` The menu is closed, and `keepMounted` of the portal keeps the positioner in the DOM.
 * @cssVariable `--anchor-width` The width of the trigger, in pixels.
 * @cssVariable `--anchor-height` The height of the trigger, in pixels.
 * @cssVariable `--available-width` The width from the trigger to the edge of the collision boundary, in pixels.
 * @cssVariable `--available-height` The height from the trigger to the edge of the collision boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the popup grows from, for the `transform-origin` of the popup. It is at the arrow, on the edge of the anchor. With no arrow, it is at the aligned edge of the popup or at the center of the anchor.
 * @cssVariable `--positioner-width` The width of the popup, and at a change of the item the width of the new content, in pixels.
 * @cssVariable `--positioner-height` The height of the popup, and at a change of the item the height of the new content, in pixels.
 */
export const Positioner: typeof NavigationMenuPositioner = NavigationMenuPositioner;
export namespace Positioner {
  export type Props = NavigationMenuPositionerProps;
  export type State = NavigationMenuPositionerState;
}

/**
 * The container of the viewport.
 * Renders a `<nav>` element.
 * @selector `[data-side]` The side of the trigger that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The trigger is out of view.
 * @selector `[hidden]` The menu is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 * @cssVariable `--popup-width` The width of the popup, in pixels: the old width, then the new width, while the popup changes its item.
 * @cssVariable `--popup-height` The height of the popup, in pixels: the old height, then the new height, while the popup changes its item.
 */
export const Popup: typeof NavigationMenuPopup = NavigationMenuPopup;
export namespace Popup {
  export type Props = NavigationMenuPopupProps;
  export type State = NavigationMenuPopupState;
}

/**
 * An element that points to the center of the active trigger.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the popup when the popup has a `position`, else the positioner.
 * @selector `[data-side]` The side of the trigger that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the trigger.
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
