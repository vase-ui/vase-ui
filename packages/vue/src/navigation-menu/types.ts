import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  LiHTMLAttributes,
  TransitionProps,
} from 'vue';
import type { AsProps } from '../common/element';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { PopupChangeEventDetails } from '../popup/root';

export type {
  Align,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';

/** The value of a root: the value of its open item, or `null`. */
export type NavigationMenuRootValue = unknown;

export type NavigationMenuRootChangeEventReason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'outside-press'
  | 'list-navigation'
  | 'focus-out'
  | 'escape-key'
  | 'link-press'
  | 'imperative-action'
  | 'none';

export type NavigationMenuRootChangeEventDetails =
  PopupChangeEventDetails<NavigationMenuRootChangeEventReason>;

export type NavigationMenuOrientation = 'horizontal' | 'vertical';

/** The side of the new trigger from the old one at a change of the item. */
export type NavigationMenuActivationDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface NavigationMenuRootProps<Value = NavigationMenuRootValue>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value of the open item, or `null`. `v-model` binds it. */
  modelValue?: Value | null | undefined;
  /**
   * The value of the open item at the mount of an uncontrolled root.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * The time in milliseconds that a mouse rests on a trigger before the open.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer left the trigger and the popup.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The axis of the list: the arrow keys between the items and the key that opens an item.
   * @default 'horizontal'
   */
  orientation?: NavigationMenuOrientation | undefined;
}

export interface NavigationMenuRootState {
  /** An item is open. */
  open: boolean;
  /** A `NavigationMenu.Root` is above the root. */
  nested: boolean;
}

export interface NavigationMenuListProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuListState {
  /** An item is open. */
  open: boolean;
}

export interface NavigationMenuItemProps<Value = NavigationMenuRootValue>
  extends AsProps, /* @vue-ignore */ Omit<LiHTMLAttributes, 'as' | 'value'> {
  /**
   * The value of the item in `v-model` of the root. With no value, a generated id.
   */
  value?: Value | undefined;
}

export interface NavigationMenuItemState {}

export interface NavigationMenuTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  id?: string | undefined;
  /**
   * The user cannot open the item. The trigger keeps the focus, with `aria-disabled`.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface NavigationMenuTriggerState {
  /** The item of the trigger is open. */
  open: boolean;
  disabled: boolean;
}

export interface NavigationMenuIconProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuIconState {
  /** The item of the icon is open. */
  open: boolean;
}

export interface NavigationMenuContentProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
  /**
   * The content stays in the DOM while its item is closed, with `hidden`. The server HTML then has
   * it in its item.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * The props of the `<Transition>` around the element, such as `name`, for the change of the item.
   * Vue animates a `<Transition>` around the part only from Vue 3.5.41.
   */
  transition?: TransitionProps | undefined;
}

export interface NavigationMenuContentState {
  /** The item of the content is open. */
  open: boolean;
  /** The side of the new trigger from the old one at the last change of the item. */
  activationDirection: NavigationMenuActivationDirection;
}

export interface NavigationMenuLinkProps
  extends AsProps, /* @vue-ignore */ Omit<AnchorHTMLAttributes, 'as'> {
  /**
   * A press of the link closes the menu and each menu above it.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export interface NavigationMenuLinkState {}

export interface NavigationMenuPortalProps extends PopupPortalProps {}

export interface NavigationMenuPortalState {}

export interface NavigationMenuBackdropProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuBackdropState {
  open: boolean;
}

export interface NavigationMenuPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
  /**
   * The popup takes its first place of an open, or the window changes its size: a style should skip
   * its animation.
   */
  instant: boolean;
}

export interface NavigationMenuPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuPopupState {
  open: boolean;
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
}

export interface NavigationMenuArrowProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface NavigationMenuViewportProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface NavigationMenuViewportState {}
