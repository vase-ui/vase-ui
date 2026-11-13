import { ScrollArea, ScrollAreaContentDataAttributes } from '@vase-ui/vue/scroll-area';
import type { ScrollAreaContentProps, ScrollAreaContentState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Content.Props = {
  as: 'section',
  stateClass: (state) => (state.hasOverflowY ? 'scrolls' : ''),
} satisfies ScrollAreaContentProps;
export const state: ScrollArea.Content.State = {
  scrolling: false,
  hasOverflowX: true,
  hasOverflowY: false,
  overflowXStart: false,
  overflowXEnd: true,
  overflowYStart: false,
  overflowYEnd: false,
  cornerHidden: true,
} satisfies ScrollAreaContentState;
export const attribute: 'data-has-overflow-y' = ScrollAreaContentDataAttributes.hasOverflowY;

export const nativeAttributes = (
  <ScrollArea.Content lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Content
    v-slots={{
      render: ({ props }: { props: HTMLProps }) => <div {...props} />,
    }}
  />
);

type ContentSlots = InstanceType<typeof ScrollArea.Content>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<ContentSlots['render']>>[0];

expectType<{ props: HTMLProps; state: ScrollArea.Content.State }, typeof renderSlotProps>(
  renderSlotProps,
);
