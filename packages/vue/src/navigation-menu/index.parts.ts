import NavigationMenuIcon from './icon/NavigationMenuIcon.vue';
import type {
  NavigationMenuIconProps,
  NavigationMenuIconState,
} from './icon/NavigationMenuIcon.vue';
import NavigationMenuItem from './item/NavigationMenuItem.vue';
import type {
  NavigationMenuItemProps,
  NavigationMenuItemState,
} from './item/NavigationMenuItem.vue';
import NavigationMenuLink from './link/NavigationMenuLink.vue';
import type {
  NavigationMenuLinkProps,
  NavigationMenuLinkState,
} from './link/NavigationMenuLink.vue';
import NavigationMenuList from './list/NavigationMenuList.vue';
import type {
  NavigationMenuListProps,
  NavigationMenuListState,
} from './list/NavigationMenuList.vue';
import NavigationMenuRoot from './root/NavigationMenuRoot.vue';
import type {
  NavigationMenuRootActions,
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootChangeEventReason,
  NavigationMenuRootProps,
  NavigationMenuRootState,
} from './root/NavigationMenuRoot.vue';

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 */
export const Root: typeof NavigationMenuRoot = NavigationMenuRoot;
export namespace Root {
  export type State = NavigationMenuRootState;
  export type Props<TValue = any> = NavigationMenuRootProps<TValue>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 */
export const List: typeof NavigationMenuList = NavigationMenuList;
export namespace List {
  export type State = NavigationMenuListState;
  export type Props = NavigationMenuListProps;
}

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 */
export const Item: typeof NavigationMenuItem = NavigationMenuItem;
export namespace Item {
  export type State = NavigationMenuItemState;
  export type Props = NavigationMenuItemProps;
}

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 */
export const Link: typeof NavigationMenuLink = NavigationMenuLink;
export namespace Link {
  export type State = NavigationMenuLinkState;
  export type Props = NavigationMenuLinkProps;
}

/**
 * An icon that indicates that the trigger button opens a menu.
 */
export const Icon: typeof NavigationMenuIcon = NavigationMenuIcon;
export namespace Icon {
  export type State = NavigationMenuIconState;
  export type Props = NavigationMenuIconProps;
}
