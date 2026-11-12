import { Collapsible } from '@vase-ui/vue/collapsible';
import type {
  CollapsiblePanelProps,
  CollapsiblePanelState,
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from '@vase-ui/vue/collapsible';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

const rootProps = {} as Collapsible.Root.Props;
const triggerProps = {} as Collapsible.Trigger.Props;
const panelProps = {} as Collapsible.Panel.Props;
const rootState = {} as Collapsible.Root.State;
const triggerState = {} as Collapsible.Trigger.State;
const panelState = {} as Collapsible.Panel.State;

expectType<CollapsibleRootProps, typeof rootProps>(rootProps);
expectType<CollapsibleTriggerProps, typeof triggerProps>(triggerProps);
expectType<CollapsiblePanelProps, typeof panelProps>(panelProps);
expectType<CollapsibleRootState, typeof rootState>(rootState);
expectType<CollapsibleTriggerState, typeof triggerState>(triggerState);
expectType<CollapsiblePanelState, typeof panelState>(panelState);

const handleOpenChange = (open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
  expectType<boolean, typeof open>(open);
  expectType<CollapsibleRootChangeEventDetails, typeof eventDetails>(eventDetails);
};

const changeReason = null as unknown as Collapsible.Root.ChangeEventReason;
const changeDetails = null as unknown as Collapsible.Root.ChangeEventDetails;

expectType<CollapsibleRootChangeEventReason, typeof changeReason>(changeReason);
expectType<CollapsibleRootChangeEventDetails, typeof changeDetails>(changeDetails);

export const tree = (
  <Collapsible.Root onOpenChange={handleOpenChange}>
    <Collapsible.Trigger />
    <Collapsible.Panel />
  </Collapsible.Root>
);

export const model = (
  <Collapsible.Root v-model:open={true}>
    <Collapsible.Trigger />
    <Collapsible.Panel keepMounted hiddenUntilFound id="panel" />
  </Collapsible.Root>
);

// @ts-expect-error `open` is a Boolean
export const wrongOpen = <Collapsible.Root open="yes" />;

type PanelSlots = InstanceType<typeof Collapsible.Panel>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<PanelSlots['render']>>[0];

expectType<{ props: HTMLProps; state: Collapsible.Panel.State }, typeof renderSlotProps>(
  renderSlotProps,
);

export const renderSlot = (
  <Collapsible.Panel
    v-slots={{
      render: ({ props }: { props: HTMLProps; state: Collapsible.Panel.State }) => (
        <section {...props} />
      ),
    }}
  />
);
