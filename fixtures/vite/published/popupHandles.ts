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

const handles: (
  | Menu.Handle<Payload>
  | Popover.Handle<Payload>
  | PreviewCard.Handle<Payload>
  | Tooltip.Handle<Payload>
)[] = [
  Menu.createHandle<Payload>(),
  new Menu.Handle<Payload>(),
  Popover.createHandle<Payload>(),
  new Popover.Handle<Payload>(),
  PreviewCard.createHandle<Payload>(),
  new PreviewCard.Handle<Payload>(),
  Tooltip.createHandle<Payload>(),
  new Tooltip.Handle<Payload>(),
];
for (const handle of handles) {
  const open: boolean = handle.isOpen;
  if (open) handle.close();
  else handle.open('second');
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
