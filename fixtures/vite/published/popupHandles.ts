import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';

interface Payload {
  label: string;
}

interface PopupHandle {
  readonly isOpen: boolean;
  open(triggerId: string): void;
  close(): void;
  readonly store: {
    readonly state: { readonly payload: Payload | undefined };
    select(key: 'isOpenedByTrigger', triggerId: string): boolean;
    set(key: 'payload', value: Payload): void;
    update(state: { payload: Payload; activeTriggerId: string }): void;
  };
}

function check(handle: PopupHandle) {
  const payload = { label: 'Second' };
  handle.store.set('payload', payload);
  handle.store.update({ payload, activeTriggerId: 'second' });
  return handle.store.select('isOpenedByTrigger', 'second');
}

const alertDialog: AlertDialog.Handle<Payload> = AlertDialog.createHandle<Payload>();
check(alertDialog);
check(new AlertDialog.Handle<Payload>());
const dialog: Dialog.Handle<Payload> = Dialog.createHandle<Payload>();
check(dialog);
check(new Dialog.Handle<Payload>());
const drawer: Drawer.Handle<Payload> = Drawer.createHandle<Payload>();
check(drawer);
check(new Drawer.Handle<Payload>());
// A Menu handle and a Popover handle have no store.
const storeless: (Menu.Handle<Payload> | Popover.Handle<Payload>)[] = [
  Menu.createHandle<Payload>(),
  new Menu.Handle<Payload>(),
  Popover.createHandle<Payload>(),
  new Popover.Handle<Payload>(),
];
for (const handle of storeless) {
  const open: boolean = handle.isOpen;
  if (open) handle.close();
  else handle.open('second');
}
const previewCard: PreviewCard.Handle<Payload> = PreviewCard.createHandle<Payload>();
check(previewCard);
check(new PreviewCard.Handle<Payload>());
const tooltip: Tooltip.Handle<Payload> = Tooltip.createHandle<Payload>();
check(tooltip);
check(new Tooltip.Handle<Payload>());
// @ts-expect-error Tooltip requires the payload type of its factory.
tooltip.store.set('payload', 1);
