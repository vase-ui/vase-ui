import type { ButtonHTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { AlertDialogHandle } from '../dialog/root';
import type {
  DialogRootChangeEventDetails,
  DialogRootChangeEventReason,
  DialogRootProps,
  DialogTriggerState,
} from '../dialog/types';

export type {
  DialogBackdropProps as AlertDialogBackdropProps,
  DialogBackdropState as AlertDialogBackdropState,
  DialogCloseProps as AlertDialogCloseProps,
  DialogCloseState as AlertDialogCloseState,
  DialogDescriptionProps as AlertDialogDescriptionProps,
  DialogDescriptionState as AlertDialogDescriptionState,
  DialogPopupProps as AlertDialogPopupProps,
  DialogPopupState as AlertDialogPopupState,
  DialogPortalProps as AlertDialogPortalProps,
  DialogPortalState as AlertDialogPortalState,
  DialogTitleProps as AlertDialogTitleProps,
  DialogTitleState as AlertDialogTitleState,
  DialogViewportProps as AlertDialogViewportProps,
  DialogViewportState as AlertDialogViewportState,
  FocusTarget,
  InteractionType,
} from '../dialog/types';

export type AlertDialogRootChangeEventReason = DialogRootChangeEventReason;

export type AlertDialogRootChangeEventDetails = DialogRootChangeEventDetails;

export interface AlertDialogRootProps<Payload = unknown> extends Omit<
  DialogRootProps<Payload>,
  'modal' | 'disablePointerDismissal' | 'handle'
> {
  /**
   * Connects the root to triggers outside it and to code. A handle from `Dialog.createHandle()` does
   * not fit.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogRootState {}

export interface AlertDialogTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /** The root names the active trigger by this id in `triggerId`. */
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The payload that the alert dialog gets when this trigger opens it. */
  payload?: Payload | undefined;
  /**
   * Connects the trigger to a root outside it. A handle from `Dialog.createHandle()` does not fit.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogTriggerState extends DialogTriggerState {}
