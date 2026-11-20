import DialogBackdrop from './DialogBackdrop.vue';
import DialogClose from './DialogClose.vue';
import DialogDescription from './DialogDescription.vue';
import DialogPopup from './DialogPopup.vue';
import DialogPortal from './DialogPortal.vue';
import DialogRoot from './DialogRoot.vue';
import DialogTitle from './DialogTitle.vue';
import DialogTrigger from './DialogTrigger.vue';
import DialogViewport from './DialogViewport.vue';
import type {
  DialogBackdropProps,
  DialogBackdropState,
  DialogCloseProps,
  DialogCloseState,
  DialogDescriptionProps,
  DialogDescriptionState,
  DialogPopupProps,
  DialogPopupState,
  DialogPortalProps,
  DialogPortalState,
  DialogRootChangeEventDetails,
  DialogRootChangeEventReason,
  DialogRootProps,
  DialogRootState,
  DialogTitleProps,
  DialogTitleState,
  DialogTriggerProps,
  DialogTriggerState,
  DialogViewportProps,
  DialogViewportState,
} from './types';

export { createHandle, DialogHandle as Handle } from './root';

/**
 * Groups the parts of the dialog.
 * Renders no element.
 */
export const Root: typeof DialogRoot = DialogRoot;
export namespace Root {
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type State = DialogRootState;
  export type ChangeEventReason = DialogRootChangeEventReason;
  export type ChangeEventDetails = DialogRootChangeEventDetails;
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

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof DialogPortal = DialogPortal;
export namespace Portal {
  export type Props = DialogPortalProps;
  export type State = DialogPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof DialogBackdrop = DialogBackdrop;
export namespace Backdrop {
  export type Props = DialogBackdropProps;
  export type State = DialogBackdropState;
}

/**
 * A container that places the popup and scrolls it.
 * Renders a `<div>` element.
 */
export const Viewport: typeof DialogViewport = DialogViewport;
export namespace Viewport {
  export type Props = DialogViewportProps;
  export type State = DialogViewportState;
}

/**
 * The container of the content of the dialog.
 * Renders a `<div>` element.
 */
export const Popup: typeof DialogPopup = DialogPopup;
export namespace Popup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}

/**
 * A heading that names the dialog.
 * Renders an `<h2>` element.
 */
export const Title: typeof DialogTitle = DialogTitle;
export namespace Title {
  export type Props = DialogTitleProps;
  export type State = DialogTitleState;
}

/**
 * A paragraph that describes the dialog.
 * Renders a `<p>` element.
 */
export const Description: typeof DialogDescription = DialogDescription;
export namespace Description {
  export type Props = DialogDescriptionProps;
  export type State = DialogDescriptionState;
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
