import DialogBackdrop from '../dialog/backdrop/DialogBackdrop.vue';
import type { DialogBackdropProps, DialogBackdropState } from '../dialog/backdrop/DialogBackdrop.vue';
import DialogClose from '../dialog/close/DialogClose.vue';
import type { DialogCloseProps, DialogCloseState } from '../dialog/close/DialogClose.vue';
import DialogDescription from '../dialog/description/DialogDescription.vue';
import type {
  DialogDescriptionProps,
  DialogDescriptionState,
} from '../dialog/description/DialogDescription.vue';
import DialogPopup from '../dialog/popup/DialogPopup.vue';
import type { DialogPopupProps, DialogPopupState } from '../dialog/popup/DialogPopup.vue';
import DialogPortal from '../dialog/portal/DialogPortal.vue';
import type { DialogPortalProps, DialogPortalState } from '../dialog/portal/DialogPortal.vue';
import DialogTitle from '../dialog/title/DialogTitle.vue';
import type { DialogTitleProps, DialogTitleState } from '../dialog/title/DialogTitle.vue';
import DialogViewport from '../dialog/viewport/DialogViewport.vue';
import type { DialogViewportProps, DialogViewportState } from '../dialog/viewport/DialogViewport.vue';
import AlertDialogRoot from './root/AlertDialogRoot.vue';
import type {
  AlertDialogRootActions,
  AlertDialogRootChangeEventDetails,
  AlertDialogRootChangeEventReason,
  AlertDialogRootProps,
  AlertDialogRootState,
} from './root/AlertDialogRoot.vue';
import AlertDialogTrigger from './trigger/AlertDialogTrigger.vue';
import type {
  AlertDialogTriggerProps,
  AlertDialogTriggerState,
} from './trigger/AlertDialogTrigger.vue';

/**
 * Groups all parts of the alert dialog.
 * Doesn't render its own HTML element.
 */
export const Root: typeof AlertDialogRoot = AlertDialogRoot;
export namespace Root {
  export type State = AlertDialogRootState;
  export type Props<Payload = unknown> = AlertDialogRootProps<Payload>;
  export type Actions = AlertDialogRootActions;
  export type ChangeEventReason = AlertDialogRootChangeEventReason;
  export type ChangeEventDetails = AlertDialogRootChangeEventDetails;
}

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof DialogBackdrop = DialogBackdrop;
export namespace Backdrop {
  export type Props = DialogBackdropProps;
  export type State = DialogBackdropState;
}

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 */
export const Close: typeof DialogClose = DialogClose;
export namespace Close {
  export type Props = DialogCloseProps;
  export type State = DialogCloseState;
}

/**
 * A paragraph with additional information about the dialog.
 * Renders a `<p>` element.
 */
export const Description: typeof DialogDescription = DialogDescription;
export namespace Description {
  export type Props = DialogDescriptionProps;
  export type State = DialogDescriptionState;
}

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 */
export const Popup: typeof DialogPopup = DialogPopup;
export namespace Popup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof DialogPortal = DialogPortal;
export namespace Portal {
  export type Props = DialogPortalProps;
  export type State = DialogPortalState;
}

/**
 * A heading that labels the dialog.
 * Renders an `<h2>` element.
 */
export const Title: typeof DialogTitle = DialogTitle;
export namespace Title {
  export type Props = DialogTitleProps;
  export type State = DialogTitleState;
}

/**
 * A button that opens the alert dialog.
 * Renders a `<button>` element.
 */
export const Trigger: typeof AlertDialogTrigger = AlertDialogTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = AlertDialogTriggerProps<Payload>;
  export type State = AlertDialogTriggerState;
}

/**
 * A positioning container for the dialog popup that can be made scrollable.
 * Renders a `<div>` element.
 */
export const Viewport: typeof DialogViewport = DialogViewport;
export namespace Viewport {
  export type Props = DialogViewportProps;
  export type State = DialogViewportState;
}

export { AlertDialogHandle as Handle, createAlertDialogHandle as createHandle } from './handle';
