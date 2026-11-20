import { expectType } from '#test-utils';
import {
  Dialog,
  type DialogRootChangeEventDetails,
  type DialogRootChangeEventReason,
} from '@vase-ui/vue/dialog';

// A handle carries the type of the payload of its root and its triggers.
const handle = Dialog.createHandle<{ id: number }>();
expectType<Dialog.Handle<{ id: number }>, typeof handle>(handle);
expectType<boolean, typeof handle.isOpen>(handle.isOpen);
handle.open(null);
handle.open('trigger');
handle.openWithPayload({ id: 1 });
// @ts-expect-error The payload of the handle is an object with an `id`.
handle.openWithPayload('text');
export const constructed: Dialog.Handle<string> = new Dialog.Handle<string>();
export const rootProps: Dialog.Root.Props<{ id: number }> = { handle, modal: 'trap-focus' };
export const triggerProps: Dialog.Trigger.Props<{ id: number }> = { handle, payload: { id: 1 } };
// @ts-expect-error The handle requires an object payload, not a string.
export const wrongPayload: Dialog.Trigger.Props<{ id: number }> = { handle, payload: 'text' };

// The default slot of a root gets the payload of its type.
type RootSlots = NonNullable<ReturnType<typeof Dialog.Root<number>>['__ctx']>['slots'];
declare const scope: Parameters<NonNullable<RootSlots['default']>>[0];
expectType<number | undefined, typeof scope.payload>(scope.payload);

// The details of a change name its reason, its trigger and the propagation of its event.
declare const details: DialogRootChangeEventDetails;
expectType<DialogRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<Dialog.Root.ChangeEventDetails, typeof details>(details);

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof Dialog.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
