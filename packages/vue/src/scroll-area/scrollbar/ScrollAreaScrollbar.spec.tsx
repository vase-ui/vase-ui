import {
  ScrollArea,
  ScrollAreaScrollbarCssVariables,
  ScrollAreaScrollbarDataAttributes,
} from '@vase-ui/vue/scroll-area';
import type { ScrollAreaScrollbarProps, ScrollAreaScrollbarState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Scrollbar.Props = {
  as: 'section',
  orientation: 'horizontal',
  keepMounted: true,
  stateClass: (state) => (state.hovering ? 'hovered' : ''),
} satisfies ScrollAreaScrollbarProps;
export const state: ScrollArea.Scrollbar.State = {
  scrolling: false,
  hasOverflowX: true,
  hasOverflowY: false,
  overflowXStart: false,
  overflowXEnd: true,
  overflowYStart: false,
  overflowYEnd: false,
  cornerHidden: true,
  hovering: false,
  orientation: 'horizontal',
} satisfies ScrollAreaScrollbarState;
export const thumbHeight: '--scroll-area-thumb-height' =
  ScrollAreaScrollbarCssVariables.scrollAreaThumbHeight;
export const attribute: 'data-orientation' = ScrollAreaScrollbarDataAttributes.orientation;

// @ts-expect-error `orientation` is `'vertical'` or `'horizontal'`
export const diagonal = <ScrollArea.Scrollbar orientation="diagonal" />;

export const nativeAttributes = (
  <ScrollArea.Scrollbar lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Scrollbar
    v-slots={{
      render: ({ props }: { props: HTMLProps }) => <div {...props} />,
    }}
  />
);

type ScrollbarSlots = InstanceType<typeof ScrollArea.Scrollbar>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<ScrollbarSlots['render']>>[0];

expectType<{ props: HTMLProps; state: ScrollArea.Scrollbar.State }, typeof renderSlotProps>(
  renderSlotProps,
);
