import { ScrollArea } from '@vase-ui/vue/scroll-area';
import type { ScrollAreaCornerProps, ScrollAreaCornerState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Corner.Props = {
  as: 'section',
  stateClass: () => 'corner',
} satisfies ScrollAreaCornerProps;
export const state: ScrollArea.Corner.State = {} satisfies ScrollAreaCornerState;

export const nativeAttributes = (
  <ScrollArea.Corner lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Corner
    v-slots={{
      render: ({ props }: { props: HTMLProps }) => <div {...props} />,
    }}
  />
);

type CornerSlots = InstanceType<typeof ScrollArea.Corner>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<CornerSlots['render']>>[0];

expectType<{ props: HTMLProps; state: ScrollArea.Corner.State }, typeof renderSlotProps>(
  renderSlotProps,
);
