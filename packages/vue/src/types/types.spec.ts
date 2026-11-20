import { expectType } from '#test-utils';
import type { Switch, SwitchChangeEventDetails, SwitchState } from '@vase-ui/vue/switch';
import type { ChangeEventDetails, ElementSlotProps, GenericEventDetails } from '@vase-ui/vue/types';

declare const switchDetails: SwitchChangeEventDetails;
export const anyChange: ChangeEventDetails = switchDetails;

// A family that knows the event of each reason writes a union, and each union is a change.
type KeyDetails =
  ChangeEventDetails<'keyboard', KeyboardEvent> | ChangeEventDetails<'input-paste', ClipboardEvent>;
declare const keyDetails: KeyDetails;
export const unionChange: ChangeEventDetails = keyDetails;
if (keyDetails.reason === 'keyboard') {
  expectType<KeyboardEvent, typeof keyDetails.event>(keyDetails.event);
} else {
  expectType<ClipboardEvent, typeof keyDetails.event>(keyDetails.event);
}

// A change has each member of the details of an event that a listener cannot cancel.
declare const noneDetails: ChangeEventDetails<'none'>;
export const generic: GenericEventDetails = noneDetails;
// @ts-expect-error The details of an event that a listener cannot cancel have no `cancel()`.
export const notChange: ChangeEventDetails = {} as GenericEventDetails;

type SwitchSlots = InstanceType<typeof Switch>['$slots'];
const elementScope = null as unknown as Parameters<NonNullable<SwitchSlots['element']>>[0];
expectType<ElementSlotProps<SwitchState>, typeof elementScope>(elementScope);
