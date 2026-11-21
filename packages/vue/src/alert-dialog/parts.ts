import DialogBackdrop from '../dialog/DialogBackdrop.vue';
import DialogClose from '../dialog/DialogClose.vue';
import DialogDescription from '../dialog/DialogDescription.vue';
import DialogPopup from '../dialog/DialogPopup.vue';
import DialogPortal from '../dialog/DialogPortal.vue';
import DialogTitle from '../dialog/DialogTitle.vue';
import DialogViewport from '../dialog/DialogViewport.vue';
import { AlertDialogHandle } from '../dialog/root';
import AlertDialogRoot from './AlertDialogRoot.vue';
import AlertDialogTrigger from './AlertDialogTrigger.vue';
import type {
  AlertDialogBackdropProps,
  AlertDialogBackdropState,
  AlertDialogCloseProps,
  AlertDialogCloseState,
  AlertDialogDescriptionProps,
  AlertDialogDescriptionState,
  AlertDialogPopupProps,
  AlertDialogPopupState,
  AlertDialogPortalProps,
  AlertDialogPortalState,
  AlertDialogRootChangeEventDetails,
  AlertDialogRootChangeEventReason,
  AlertDialogRootEmits,
  AlertDialogRootProps,
  AlertDialogRootState,
  AlertDialogTitleProps,
  AlertDialogTitleState,
  AlertDialogTriggerProps,
  AlertDialogTriggerState,
  AlertDialogViewportProps,
  AlertDialogViewportState,
} from './types';

export { AlertDialogHandle as Handle };

/** Makes a handle. `new AlertDialog.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new AlertDialogHandle<Payload>();
}

/**
 * Groups the parts of the alert dialog. The alert dialog is always modal. Escape and
 * `AlertDialog.Close` close it, and a press outside the popup does not.
 * Renders no element.
 */
export const Root: typeof AlertDialogRoot = AlertDialogRoot;
export namespace Root {
  export type Props<Payload = unknown> = AlertDialogRootProps<Payload>;
  export type Emits = AlertDialogRootEmits;
  export type State = AlertDialogRootState;
  export type ChangeEventReason = AlertDialogRootChangeEventReason;
  export type ChangeEventDetails = AlertDialogRootChangeEventDetails;
}

/**
 * A button that opens the alert dialog.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The alert dialog is open for this trigger.
 * @selector `:disabled` The trigger is a native button, and it or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and it is disabled.
 */
export const Trigger: typeof AlertDialogTrigger = AlertDialogTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = AlertDialogTriggerProps<Payload>;
  export type State = AlertDialogTriggerState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof DialogPortal = DialogPortal;
export namespace Portal {
  export type Props = AlertDialogPortalProps;
  export type State = AlertDialogPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 * @selector `[hidden]` The alert dialog is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 */
export const Backdrop: typeof DialogBackdrop = DialogBackdrop;
export namespace Backdrop {
  export type Props = AlertDialogBackdropProps;
  export type State = AlertDialogBackdropState;
}

/**
 * A container that places the popup and scrolls it.
 * Renders a `<div>` element.
 * @selector `[hidden]` The alert dialog is closed, and `keepMounted` of the portal keeps the viewport in the DOM.
 * @selector `[data-nested]` The root of the alert dialog is inside a `Dialog.Root`, an `AlertDialog.Root` or a `Drawer.Root`.
 * @selector `[data-nested-dialog-open]` A dialog, an alert dialog or a drawer is open above this alert dialog.
 * @selector `:has(> .v-leave-active)` The popup leaves. Use the leave class of the `<Transition>` around the popup.
 */
export const Viewport: typeof DialogViewport = DialogViewport;
export namespace Viewport {
  export type Props = AlertDialogViewportProps;
  export type State = AlertDialogViewportState;
}

/**
 * The container of the content of the alert dialog, with the role `alertdialog`.
 * Renders a `<div>` element.
 * @selector `[hidden]` The alert dialog is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 * @selector `[data-nested]` The root of the alert dialog is inside a `Dialog.Root`, an `AlertDialog.Root` or a `Drawer.Root`.
 * @selector `[data-nested-dialog-open]` A dialog, an alert dialog or a drawer is open above this alert dialog.
 * @cssVariable `--nested-dialogs` The number of dialogs, alert dialogs and drawers that are open above this alert dialog.
 */
export const Popup: typeof DialogPopup = DialogPopup;
export namespace Popup {
  export type Props = AlertDialogPopupProps;
  export type State = AlertDialogPopupState;
}

/**
 * A heading that names the alert dialog.
 * Renders an `<h2>` element.
 */
export const Title: typeof DialogTitle = DialogTitle;
export namespace Title {
  export type Props = AlertDialogTitleProps;
  export type State = AlertDialogTitleState;
}

/**
 * A paragraph that describes the alert dialog.
 * Renders a `<p>` element.
 */
export const Description: typeof DialogDescription = DialogDescription;
export namespace Description {
  export type Props = AlertDialogDescriptionProps;
  export type State = AlertDialogDescriptionState;
}

/**
 * A button that closes the alert dialog.
 * Renders a `<button>` element.
 * @selector `:disabled` The button is a native button, and it or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Close: typeof DialogClose = DialogClose;
export namespace Close {
  export type Props = AlertDialogCloseProps;
  export type State = AlertDialogCloseState;
}
