import AlertDialogRoot from './root/AlertDialogRoot.vue';
import type {
  AlertDialogRootActions,
  AlertDialogRootChangeEventDetails,
  AlertDialogRootChangeEventReason,
  AlertDialogRootProps,
  AlertDialogRootState,
} from './root/AlertDialogRoot.vue';

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

export { AlertDialogHandle as Handle, createAlertDialogHandle as createHandle } from './handle';
