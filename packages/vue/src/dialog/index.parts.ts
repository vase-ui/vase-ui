import DialogRoot from './root/DialogRoot.vue';
import type {
  DialogRootActions,
  DialogRootChangeEventDetails,
  DialogRootChangeEventReason,
  DialogRootProps,
  DialogRootState,
} from './root/DialogRoot.vue';

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

export { createDialogHandle as createHandle, DialogHandle as Handle } from './store/DialogHandle';
