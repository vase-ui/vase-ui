import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { BasePopupHandle } from '../../utils/popups/popupHandle';
import { createNullDialogStore } from './DialogStore';
import type { DialogHandleStore, DialogStore } from './DialogStore';

/**
 * Controls a Dialog imperatively and associates detached `Dialog.Trigger` components with a
 * `Dialog.Root`. Create one with `Dialog.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class DialogHandle<Payload> extends BasePopupHandle<
  DialogHandleStore<Payload>,
  DialogStore<Payload>
> {
  constructor() {
    super(createNullDialogStore<Payload>(), 'Dialog', false);
  }

  /**
   * Opens the dialog, optionally associating it with a trigger.
   *
   * Call this method only in an event handler or an effect, and not in a render.
   *
   * @param triggerId ID of the trigger to associate with the dialog. The trigger must be a matching
   * `Dialog.Trigger` with this handle passed as a prop. Pass `null` to open without associating any trigger.
   */
  open(triggerId: string | null) {
    this.openByTrigger(triggerId);
  }

  /**
   * Opens the dialog with the given payload, without associating it with any trigger.
   *
   * Call this method only in an event handler or an effect, and not in a render.
   *
   * @param payload Payload to set when opening the dialog. The default slot of the root gets it.
   */
  openWithPayload(payload: Payload) {
    const attachedStore = this.attachedStoreUntracked;

    if (attachedStore === null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Vase UI: DialogHandle.openWithPayload() was called while no root that uses this handle is mounted. ' +
            'The handle ignored the call and its payload. Mount a root with this handle before you call openWithPayload().',
        );
      }
      return;
    }

    attachedStore.set('payload', payload);
    attachedStore.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));
  }

  /**
   * Closes the dialog.
   *
   * Call this method only in an event handler or an effect, and not in a render.
   */
  close() {
    this.closePopup();
  }

  /**
   * Whether the dialog is currently open. Returns `false` while no root is attached to the handle.
   */
  get isOpen() {
    return this.attachedStore?.select('open') ?? false;
  }
}

/**
 * Creates a new handle to connect a Dialog.Root with detached Dialog.Trigger components.
 */
export function createDialogHandle<Payload>(): DialogHandle<Payload> {
  return new DialogHandle<Payload>();
}
