import DialogBackdrop from './backdrop/DialogBackdrop.vue';
import type { DialogBackdropProps, DialogBackdropState } from './backdrop/DialogBackdrop.vue';
import DialogClose from './close/DialogClose.vue';
import type { DialogCloseProps, DialogCloseState } from './close/DialogClose.vue';
import DialogDescription from './description/DialogDescription.vue';
import type {
  DialogDescriptionProps,
  DialogDescriptionState,
} from './description/DialogDescription.vue';
import DialogPopup from './popup/DialogPopup.vue';
import type { DialogPopupProps, DialogPopupState } from './popup/DialogPopup.vue';
import DialogPortal from './portal/DialogPortal.vue';
import type { DialogPortalProps, DialogPortalState } from './portal/DialogPortal.vue';
import DialogRoot from './root/DialogRoot.vue';
import type {
  DialogRootActions,
  DialogRootChangeEventDetails,
  DialogRootChangeEventReason,
  DialogRootProps,
  DialogRootState,
} from './root/DialogRoot.vue';
import DialogTitle from './title/DialogTitle.vue';
import type { DialogTitleProps, DialogTitleState } from './title/DialogTitle.vue';
import DialogTrigger from './trigger/DialogTrigger.vue';
import type { DialogTriggerProps, DialogTriggerState } from './trigger/DialogTrigger.vue';
import DialogViewport from './viewport/DialogViewport.vue';
import type { DialogViewportProps, DialogViewportState } from './viewport/DialogViewport.vue';

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
  export type State = DialogPortalState;
  export type Props = DialogPortalProps;
}

/**
 * Groups all parts of the dialog.
 * Doesn't render its own HTML element.
 */
export const Root: typeof DialogRoot = DialogRoot;
export namespace Root {
  export type State = DialogRootState;
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type Actions = DialogRootActions;
  export type ChangeEventReason = DialogRootChangeEventReason;
  export type ChangeEventDetails = DialogRootChangeEventDetails;
}

/**
 * A positioning container for the dialog popup that can be made scrollable.
 * Renders a `<div>` element.
 */
export const Viewport: typeof DialogViewport = DialogViewport;
export namespace Viewport {
  export type State = DialogViewportState;
  export type Props = DialogViewportProps;
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
 * A button that opens the dialog.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DialogTrigger = DialogTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}

export { createDialogHandle as createHandle, DialogHandle as Handle } from './store/DialogHandle';
