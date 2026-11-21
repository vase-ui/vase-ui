import { Dialog } from '@vase-ui/vue/dialog';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';

export const dialogHandle: Dialog.Handle<number> = Dialog.createHandle<number>();
export const alertDialogHandle: AlertDialog.Handle<number> = AlertDialog.createHandle<number>();
export const drawerHandle: Drawer.Handle<number> = Drawer.createHandle<number>();
export const menuHandle: Menu.Handle<number> = Menu.createHandle<number>();
export const popoverHandle: Popover.Handle<number> = Popover.createHandle<number>();
export const previewCardHandle: PreviewCard.Handle<number> = PreviewCard.createHandle<number>();
export const tooltipHandle: Tooltip.Handle<number> = Tooltip.createHandle<number>();

export function useHandles() {
  for (const handle of [menuHandle, popoverHandle, previewCardHandle, tooltipHandle]) {
    const open: boolean = handle.isOpen;
    if (open) handle.close();
    else handle.open('trigger');
  }
  for (const handle of [dialogHandle, alertDialogHandle, drawerHandle]) {
    const open: boolean = handle.isOpen;
    if (open) handle.close();
    else handle.open(null);
  }
  dialogHandle.openWithPayload(1);
  alertDialogHandle.openWithPayload(1);
  drawerHandle.openWithPayload(1);
  // @ts-expect-error The handle requires a number payload.
  dialogHandle.openWithPayload('one');
}
