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
import { expectType } from '#test-utils';

// The namespace types are the flat types.
expectType<CollapsibleRootProps, Collapsible.Root.Props>({} as Collapsible.Root.Props);
expectType<CollapsibleRootState, Collapsible.Root.State>({} as Collapsible.Root.State);
expectType<CollapsibleRootChangeEventReason, Collapsible.Root.ChangeEventReason>('none');
expectType<CollapsibleRootChangeEventDetails, Collapsible.Root.ChangeEventDetails>(
  {} as Collapsible.Root.ChangeEventDetails,
);
expectType<CollapsibleTriggerProps, Collapsible.Trigger.Props>({} as Collapsible.Trigger.Props);
expectType<CollapsibleTriggerState, Collapsible.Trigger.State>({} as Collapsible.Trigger.State);
expectType<CollapsiblePanelProps, Collapsible.Panel.Props>({} as Collapsible.Panel.Props);
expectType<CollapsiblePanelState, Collapsible.Panel.State>({} as Collapsible.Panel.State);

const onOpenChange = (open: boolean, details: CollapsibleRootChangeEventDetails) => {
  expectType<'trigger-press' | 'none', typeof details.reason>(details.reason);
  expectType<Event, typeof details.event>(details.event);
  return open;
};
const onClick = (event: MouseEvent) => event.preventDefault();

// Each part takes the native attributes and listeners of its element, and `as`.
export const tree = (
  <Collapsible.Root as="section" v-model:open={false} onOpenChange={onOpenChange} lang="fr">
    <Collapsible.Trigger as="span" type="button" onClick={onClick} disabled />
    <Collapsible.Panel as="article" keepMounted hiddenUntilFound id="panel" lang="fr" />
  </Collapsible.Root>
);

// @ts-expect-error `open` is a Boolean.
export const wrongOpen = <Collapsible.Root open="yes" />;

type PanelSlots = InstanceType<typeof Collapsible.Panel>['$slots'];
const elementSlotProps = null as unknown as Parameters<NonNullable<PanelSlots['element']>>[0];

expectType<
  {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CollapsiblePanelState;
  },
  typeof elementSlotProps
>(elementSlotProps);
