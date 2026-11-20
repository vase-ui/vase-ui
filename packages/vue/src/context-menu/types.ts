import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type {
  MenuPositionerProps,
  MenuPositionerState,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootProps,
} from '../menu/types';

export interface ContextMenuRootProps
  extends Omit<
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
