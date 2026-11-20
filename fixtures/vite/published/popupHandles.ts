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

const menu: Menu.Handle<Payload> = Menu.createHandle<Payload>();
check(menu);
check(new Menu.Handle<Payload>());
// A handle of Popover, Dialog, Alert Dialog and Drawer has no store.
const popovers: Popover.Handle<Payload>[] = [
  Popover.createHandle<Payload>(),
  new Popover.Handle<Payload>(),
];
for (const popover of popovers) {
  const open: boolean = popover.isOpen;
  if (open) popover.close();
  else popover.open('second');
}
const dialogs: Dialog.Handle<Payload>[] = [
  Dialog.createHandle<Payload>(),
  new Dialog.Handle<Payload>(),
  AlertDialog.createHandle<Payload>(),
  new AlertDialog.Handle<Payload>(),
  Drawer.createHandle<Payload>(),
  new Drawer.Handle<Payload>(),
];
for (const dialog of dialogs) {
  const open: boolean = dialog.isOpen;
  if (open) dialog.close();
  else if (dialog instanceof AlertDialog.Handle) dialog.open(null);
  else dialog.openWithPayload({ label: 'Second' });
}
const previewCard: PreviewCard.Handle<Payload> = PreviewCard.createHandle<Payload>();
check(previewCard);
check(new PreviewCard.Handle<Payload>());
// A Tooltip handle has no store.
const tooltips: Tooltip.Handle<Payload>[] = [
  Tooltip.createHandle<Payload>(),
  new Tooltip.Handle<Payload>(),
];
for (const tooltip of tooltips) {
  const open: boolean = tooltip.isOpen;
  if (open) tooltip.close();
  else tooltip.open('second');
}
