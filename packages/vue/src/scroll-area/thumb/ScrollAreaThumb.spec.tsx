import { ScrollArea, ScrollAreaThumbDataAttributes } from '@vase-ui/vue/scroll-area';
import type { ScrollAreaThumbProps, ScrollAreaThumbState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Thumb.Props = {
  as: 'section',
} satisfies ScrollAreaThumbProps;
export const state: ScrollArea.Thumb.State = {
  scrolling: false,
  orientation: 'horizontal',
} satisfies ScrollAreaThumbState;
export const orientationAttribute: 'data-orientation' = ScrollAreaThumbDataAttributes.orientation;
export const scrollingAttribute: 'data-scrolling' = ScrollAreaThumbDataAttributes.scrolling;

export const nativeAttributes = (
  <ScrollArea.Thumb lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Thumb
    v-slots={{
      render: ({ props, state }: { props: HTMLProps; state: ScrollArea.Thumb.State }) => (
        <div {...props} class={{ scrolling: state.scrolling }} />
      ),
    }}
  />
);

type ThumbSlots = InstanceType<typeof ScrollArea.Thumb>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<ThumbSlots['render']>>[0];

expectType<{ props: HTMLProps; state: ScrollArea.Thumb.State }, typeof renderSlotProps>(
  renderSlotProps,
);
