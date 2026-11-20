import { expectType } from '#test-utils';
import {
  Popover,
  type PopoverRootChangeEventDetails,
  type PopoverRootChangeEventReason,
} from '@vase-ui/vue/popover';

// A handle carries the type of the payload of its root and its triggers.
const handle = Popover.createHandle<{ id: number }>();
expectType<Popover.Handle<{ id: number }>, typeof handle>(handle);
expectType<boolean, typeof handle.isOpen>(handle.isOpen);
export const constructed: Popover.Handle<string> = new Popover.Handle<string>();
export const rootProps: Popover.Root.Props<{ id: number }> = { handle, modal: 'trap-focus' };
export const triggerProps: Popover.Trigger.Props<{ id: number }> = { handle, payload: { id: 1 } };

// The details of a change name its reason, its trigger and the propagation of its event.
declare const details: PopoverRootChangeEventDetails;
expectType<PopoverRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<() => void, typeof details.allowPropagation>(details.allowPropagation);
expectType<Popover.Root.ChangeEventDetails, typeof details>(details);

// The positioner takes the sides of Base UI, an offset function and a virtual anchor.
export const positionerProps: Popover.Positioner.Props = {
  side: 'inline-end',
  align: 'start',
  sideOffset: ({ anchor }) => anchor.height,
  anchor: { getBoundingClientRect: () => new DOMRect() },
  collisionAvoidance: { side: 'shift', align: 'none' },
};
// @ts-expect-error `middle` is no side.
export const wrongSide: Popover.Positioner.Props = { side: 'middle' };

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof Popover.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
