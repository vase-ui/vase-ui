import { expectType } from '#test-utils';
import { AlertDialog, type AlertDialogRootChangeEventDetails } from '@vase-ui/vue/alert-dialog';
import { Dialog } from '@vase-ui/vue/dialog';

const handle = AlertDialog.createHandle<number>();
const dialogHandle = Dialog.createHandle<number>();
expectType<AlertDialog.Handle<number>, typeof handle>(handle);

export const rootProps: AlertDialog.Root.Props<number> = { handle, defaultOpen: true };
export const triggerProps: AlertDialog.Trigger.Props<number> = { handle, payload: 42 };
// @ts-expect-error The handle requires a number payload, not a string.
export const wrongPayload: AlertDialog.Trigger.Props<number> = { handle, payload: 'invalid' };
// @ts-expect-error A handle of Dialog is no handle of Alert Dialog.
export const dialogRoot: AlertDialog.Root.Props<number> = { handle: dialogHandle };
// @ts-expect-error A handle of Dialog is no handle of Alert Dialog.
export const dialogTrigger: AlertDialog.Trigger.Props<number> = { handle: dialogHandle };
// @ts-expect-error An alert dialog is always modal.
export const modal: AlertDialog.Root.Props = { modal: false };

// The default slot of a root gets the payload of its type.
type RootSlots = NonNullable<ReturnType<typeof AlertDialog.Root<number>>['__ctx']>['slots'];
declare const scope: Parameters<NonNullable<RootSlots['default']>>[0];
expectType<number | undefined, typeof scope.payload>(scope.payload);

declare const details: AlertDialogRootChangeEventDetails;
expectType<AlertDialog.Root.ChangeEventDetails, typeof details>(details);
