import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type {
  MenuArrowProps,
  MenuArrowState,
  MenuBackdropProps,
  MenuBackdropState,
  MenuCheckboxItemChangeEventDetails,
  MenuCheckboxItemChangeEventReason,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
  MenuGroupLabelProps,
  MenuGroupLabelState,
  MenuGroupProps,
  MenuGroupState,
  MenuItemProps,
  MenuItemState,
  MenuLinkItemProps,
  MenuLinkItemState,
  MenuPopupProps,
  MenuPopupState,
  MenuPortalProps,
  MenuPortalState,
  MenuPositionerProps,
  MenuPositionerState,
  MenuRadioGroupChangeEventDetails,
  MenuRadioGroupChangeEventReason,
  MenuRadioGroupProps,
  MenuRadioGroupState,
  MenuRadioItemProps,
  MenuRadioItemState,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootProps,
  MenuSeparatorProps,
  MenuSeparatorState,
  MenuSubmenuRootChangeEventDetails,
  MenuSubmenuRootChangeEventReason,
  MenuSubmenuRootProps,
  MenuSubmenuRootState,
  MenuSubmenuTriggerProps,
  MenuSubmenuTriggerState,
} from '../menu/types';

export interface ContextMenuRootProps extends Omit<
  MenuRootProps,
  'triggerId' | 'defaultTriggerId' | 'handle' | 'modal' | 'closeParentOnEsc'
> {}

export interface ContextMenuRootState {}

export type ContextMenuRootChangeEventReason = MenuRootChangeEventReason;
export type ContextMenuRootChangeEventDetails = MenuRootChangeEventDetails;
export type ContextMenuRootHighlightEventReason = MenuRootHighlightEventReason;
export type ContextMenuRootHighlightEventDetails = MenuRootHighlightEventDetails;

export interface ContextMenuTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ContextMenuTriggerState {
  /** The menu is open. */
  open: boolean;
}

export interface ContextMenuPositionerProps extends Omit<MenuPositionerProps, 'positionMethod'> {}

export interface ContextMenuPositionerState extends MenuPositionerState {}

// The parts of Menu in a context menu.
export type ContextMenuPortalProps = MenuPortalProps;
export type ContextMenuPortalState = MenuPortalState;
export type ContextMenuBackdropProps = MenuBackdropProps;
export type ContextMenuBackdropState = MenuBackdropState;
export type ContextMenuPopupProps = MenuPopupProps;
export type ContextMenuPopupState = MenuPopupState;
export type ContextMenuArrowProps = MenuArrowProps;
export type ContextMenuArrowState = MenuArrowState;
export type ContextMenuItemProps = MenuItemProps;
export type ContextMenuItemState = MenuItemState;
export type ContextMenuLinkItemProps = MenuLinkItemProps;
export type ContextMenuLinkItemState = MenuLinkItemState;
export type ContextMenuCheckboxItemProps = MenuCheckboxItemProps;
export type ContextMenuCheckboxItemState = MenuCheckboxItemState;
export type ContextMenuRadioGroupProps<Value = unknown> = MenuRadioGroupProps<Value>;
export type ContextMenuRadioGroupState = MenuRadioGroupState;
export type ContextMenuRadioItemProps<Value = unknown> = MenuRadioItemProps<Value>;
export type ContextMenuRadioItemState = MenuRadioItemState;
export type ContextMenuGroupProps = MenuGroupProps;
export type ContextMenuGroupState = MenuGroupState;
export type ContextMenuGroupLabelProps = MenuGroupLabelProps;
export type ContextMenuGroupLabelState = MenuGroupLabelState;
export type ContextMenuSeparatorProps = MenuSeparatorProps;
export type ContextMenuSeparatorState = MenuSeparatorState;
export type ContextMenuSubmenuRootProps = MenuSubmenuRootProps;
export type ContextMenuSubmenuRootState = MenuSubmenuRootState;
export type ContextMenuSubmenuTriggerProps = MenuSubmenuTriggerProps;
export type ContextMenuSubmenuTriggerState = MenuSubmenuTriggerState;
export type ContextMenuCheckboxItemChangeEventReason = MenuCheckboxItemChangeEventReason;
export type ContextMenuCheckboxItemChangeEventDetails = MenuCheckboxItemChangeEventDetails;
export type ContextMenuRadioGroupChangeEventReason = MenuRadioGroupChangeEventReason;
export type ContextMenuRadioGroupChangeEventDetails = MenuRadioGroupChangeEventDetails;
export type ContextMenuSubmenuRootChangeEventReason = MenuSubmenuRootChangeEventReason;
export type ContextMenuSubmenuRootChangeEventDetails = MenuSubmenuRootChangeEventDetails;
