import { expectType } from '#test-utils';
import {
  Tooltip,
  type TooltipRootChangeEventDetails,
  type TooltipRootChangeEventReason,
} from '@vase-ui/vue/tooltip';

// A handle carries the type of the payload of its root and its triggers.
const handle = Tooltip.createHandle<{ id: number }>();
expectType<Tooltip.Handle<{ id: number }>, typeof handle>(handle);
expectType<boolean, typeof handle.isOpen>(handle.isOpen);
export const constructed: Tooltip.Handle<string> = new Tooltip.Handle<string>();
export const rootProps: Tooltip.Root.Props<{ id: number }> = { handle, trackCursorAxis: 'x' };
export const triggerProps: Tooltip.Trigger.Props<{ id: number }> = { handle, payload: { id: 1 } };
// @ts-expect-error The payload of the trigger has the type of the handle.
export const wrongPayload: Tooltip.Trigger.Props<{ id: number }> = { handle, payload: 'one' };

// The details of a change name its reason and its trigger.
declare const details: TooltipRootChangeEventDetails;
expectType<TooltipRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<Tooltip.Root.ChangeEventDetails, typeof details>(details);

// The positioner takes the placement props, and no `keepMounted`: the portal has it.
export const positionerProps: Tooltip.Positioner.Props = { side: 'inline-end', sideOffset: 8 };
// @ts-expect-error `keepMounted` is a prop of the portal.
export const keptPositioner: Tooltip.Positioner.Props = { keepMounted: true };
export const portalProps: Tooltip.Portal.Props = { keepMounted: true, to: null };

// The state of each part, which its slots give.
declare const triggerState: Tooltip.Trigger.State;
expectType<boolean, typeof triggerState.disabled>(triggerState.disabled);
declare const positionerState: Tooltip.Positioner.State;
expectType<
  'delay' | 'focus' | 'dismiss' | 'tracking-cursor' | undefined,
  typeof positionerState.instant
>(positionerState.instant);

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof Tooltip.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
