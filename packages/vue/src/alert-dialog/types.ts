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
   * Connects the root to triggers outside it and to code. The type refuses a handle from
   * `Dialog.createHandle()`.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogRootEmits {
  /** The alert dialog opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: AlertDialogRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
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
   * Connects the trigger to a root outside it. The type refuses a handle from
   * `Dialog.createHandle()`.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogTriggerState extends DialogTriggerState {}
