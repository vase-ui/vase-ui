export * as AlertDialog from './index.parts';

export { default as AlertDialogRoot } from './root/AlertDialogRoot.vue';
export { default as AlertDialogTrigger } from './trigger/AlertDialogTrigger.vue';
export { default as AlertDialogPortal } from '../dialog/portal/DialogPortal.vue';
export { default as AlertDialogBackdrop } from '../dialog/backdrop/DialogBackdrop.vue';
export { default as AlertDialogViewport } from '../dialog/viewport/DialogViewport.vue';
export { default as AlertDialogPopup } from '../dialog/popup/DialogPopup.vue';
export { default as AlertDialogTitle } from '../dialog/title/DialogTitle.vue';
export { default as AlertDialogDescription } from '../dialog/description/DialogDescription.vue';
export { default as AlertDialogClose } from '../dialog/close/DialogClose.vue';

export type * from './root/AlertDialogRoot.vue';

export type {
  DialogBackdropProps as AlertDialogBackdropProps,
  DialogBackdropState as AlertDialogBackdropState,
} from '../dialog/backdrop/DialogBackdrop.vue';
export type {
  DialogCloseProps as AlertDialogCloseProps,
  DialogCloseState as AlertDialogCloseState,
} from '../dialog/close/DialogClose.vue';
export type {
  DialogDescriptionProps as AlertDialogDescriptionProps,
  DialogDescriptionState as AlertDialogDescriptionState,
} from '../dialog/description/DialogDescription.vue';
export type {
  DialogPopupProps as AlertDialogPopupProps,
  DialogPopupState as AlertDialogPopupState,
} from '../dialog/popup/DialogPopup.vue';
export type {
  DialogPortalProps as AlertDialogPortalProps,
  DialogPortalState as AlertDialogPortalState,
} from '../dialog/portal/DialogPortal.vue';
export type {
  DialogTitleProps as AlertDialogTitleProps,
  DialogTitleState as AlertDialogTitleState,
} from '../dialog/title/DialogTitle.vue';
export type * from './trigger/AlertDialogTrigger.vue';
export type {
  DialogViewportProps as AlertDialogViewportProps,
  DialogViewportState as AlertDialogViewportState,
} from '../dialog/viewport/DialogViewport.vue';

export * as AlertDialogBackdropDataAttributes from '../dialog/backdrop/DialogBackdropDataAttributes';
export * as AlertDialogCloseDataAttributes from '../dialog/close/DialogCloseDataAttributes';
export * as AlertDialogPopupCssVariables from '../dialog/popup/DialogPopupCssVars';
export * as AlertDialogPopupDataAttributes from '../dialog/popup/DialogPopupDataAttributes';
export * as AlertDialogTriggerDataAttributes from './trigger/AlertDialogTriggerDataAttributes';
export * as AlertDialogViewportDataAttributes from '../dialog/viewport/DialogViewportDataAttributes';
