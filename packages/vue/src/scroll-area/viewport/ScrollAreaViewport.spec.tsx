import {
  ScrollArea,
  ScrollAreaViewportCssVariables,
  ScrollAreaViewportDataAttributes,
} from '@vase-ui/vue/scroll-area';
import type { ScrollAreaViewportProps, ScrollAreaViewportState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Viewport.Props = {
  as: 'section',
  stateClass: (state) => (state.hasOverflowY ? 'scrolls' : ''),
} satisfies ScrollAreaViewportProps;
export const state: ScrollArea.Viewport.State = {
  scrolling: false,
  hasOverflowX: true,
  hasOverflowY: false,
  overflowXStart: false,
  overflowXEnd: true,
  overflowYStart: false,
  overflowYEnd: false,
  cornerHidden: true,
} satisfies ScrollAreaViewportState;
export const overflowXStart: '--scroll-area-overflow-x-start' =
  ScrollAreaViewportCssVariables.scrollAreaOverflowXStart;
export const attribute: 'data-scrolling' = ScrollAreaViewportDataAttributes.scrolling;

export const nativeAttributes = (
  <ScrollArea.Viewport lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Viewport
    v-slots={{
      render: ({ props }: { props: HTMLProps }) => <div {...props} />,
    }}
  />
);

type ViewportSlots = InstanceType<typeof ScrollArea.Viewport>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<ViewportSlots['render']>>[0];

expectType<{ props: HTMLProps; state: ScrollArea.Viewport.State }, typeof renderSlotProps>(
  renderSlotProps,
);
