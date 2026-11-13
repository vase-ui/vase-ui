import { provide, watch } from 'vue';
import { usePopupRoot, usePopupRootSync } from '../../utils/popups/popupRoot';
import { DialogStore } from '../store/DialogStore';
import type { DialogRootChangeEventDetails, DialogRootProps } from './DialogRoot.vue';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';
import { useDialogInteractions } from './useDialogRoot';

type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';

const ROOT_NAMES: Record<DialogRootMode, string> = {
  dialog: 'DialogRoot',
  'alert-dialog': 'AlertDialogRoot',
  drawer: 'DrawerRoot',
};

interface DialogRootEmit {
  (event: 'openChange', open: boolean, eventDetails: DialogRootChangeEventDetails): void;
  (event: 'update:open', open: boolean): void;
  (event: 'openChangeComplete', open: boolean): void;
}

/**
 * Does what the roots of Dialog, Alert Dialog and Drawer do. Call it in `setup` of the root. The
 * part exposes `actions` and renders `<slot :payload="payload" />`.
 */
export function useRenderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
  emit: DialogRootEmit,
) {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;
  const rootState = () => ({
    modal: isAlertDialog ? true : (props.modal ?? true),
    disablePointerDismissal: isAlertDialog || (props.disablePointerDismissal ?? false),
    nested,
    role,
  });

  const { store, open, payload, actions } = usePopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new DialogStore<Payload>({ ...initialState, ...rootState() }, defaultPopupId),
    {
      name: ROOT_NAMES[mode],
      handle: () => props.handle,
      onOpenChange(nextOpen, eventDetails) {
        emit('openChange', nextOpen, eventDetails);
        if (!eventDetails.isCanceled) {
          emit('update:open', nextOpen);
        }
      },
      onOpenChangeComplete(nextOpen) {
        emit('openChangeComplete', nextOpen);
      },
    },
  );

  watch(rootState, (values) => store.update(values));

  usePopupRootSync(store, open);

  provide(DialogRootContext, store as DialogStore<unknown>);

  useDialogInteractions({ store, parentContext: parentStore?.context, isDrawer });

  return { store, payload, actions };
}
