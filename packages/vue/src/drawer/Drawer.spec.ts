import { expectType } from '#test-utils';
import { Dialog } from '@vase-ui/vue/dialog';
import {
  Drawer,
  type DrawerRootChangeEventDetails,
  type DrawerRootChangeEventReason,
  type DrawerRootSnapPointChangeEventDetails,
  type DrawerSnapPoint,
} from '@vase-ui/vue/drawer';

// A handle carries the type of the payload of its root and its triggers.
const handle = Drawer.createHandle<{ id: number }>();
expectType<Drawer.Handle<{ id: number }>, typeof handle>(handle);
export const constructed: Drawer.Handle<string> = new Drawer.Handle<string>();
export const rootProps: Drawer.Root.Props<{ id: number }> = {
  handle,
  swipeDirection: 'left',
  snapPoints: [0.5, '148px', '30rem', 1],
  snapPoint: null,
};
export const triggerProps: Drawer.Trigger.Props<{ id: number }> = { handle, payload: { id: 1 } };
// @ts-expect-error A handle of Dialog is no handle of Drawer.
export const dialogHandle: Drawer.Root.Props = { handle: Dialog.createHandle() };
// @ts-expect-error `forward` is no swipe direction.
export const wrongDirection: Drawer.Root.Props = { swipeDirection: 'forward' };

// The details of a change name its reason, its trigger and the propagation of its event.
declare const details: DrawerRootChangeEventDetails;
expectType<DrawerRootChangeEventReason, typeof details.reason>(details.reason);
expectType<() => void, typeof details.allowPropagation>(details.allowPropagation);
expectType<Drawer.Root.ChangeEventDetails, typeof details>(details);
export const swipe: DrawerRootChangeEventReason = 'swipe';
export const backGesture: DrawerRootChangeEventReason = 'close-watcher';

// A change of the snap point stops no event, so its details have no propagation.
declare const snapDetails: DrawerRootSnapPointChangeEventDetails;
expectType<DrawerRootChangeEventReason, typeof snapDetails.reason>(snapDetails.reason);
expectType<Drawer.Root.SnapPointChangeEventDetails, typeof snapDetails>(snapDetails);
// @ts-expect-error The details of a snap point have no `allowPropagation`.
snapDetails.allowPropagation();
export const point: DrawerSnapPoint = '148px';

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof Drawer.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);

// The default slot of a root gets the payload of its type.
type RootSlots = NonNullable<ReturnType<typeof Drawer.Root<number>>['__ctx']>['slots'];
declare const scope: Parameters<NonNullable<RootSlots['default']>>[0];
expectType<number | undefined, typeof scope.payload>(scope.payload);
