import { h } from 'vue';
import type { Component } from 'vue';
import {
  ScrollArea,
  ScrollAreaRootCssVariables,
  ScrollAreaRootDataAttributes,
} from '@vase-ui/vue/scroll-area';
import type { ScrollAreaRootProps, ScrollAreaRootState } from '@vase-ui/vue/scroll-area';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: ScrollArea.Root.Props = {
  overflowEdgeThreshold: { xStart: 1, yEnd: 2 },
} satisfies ScrollAreaRootProps;
export const state: ScrollArea.Root.State = {
  scrolling: false,
  hasOverflowX: true,
  hasOverflowY: false,
  overflowXStart: false,
  overflowXEnd: true,
  overflowYStart: false,
  overflowYEnd: false,
  cornerHidden: true,
} satisfies ScrollAreaRootState;
export const cornerWidth: '--scroll-area-corner-width' =
  ScrollAreaRootCssVariables.scrollAreaCornerWidth;
export const attribute: 'data-scrolling' = ScrollAreaRootDataAttributes.scrolling;

export const numberThreshold = <ScrollArea.Root overflowEdgeThreshold={8} />;
export const objectThreshold = <ScrollArea.Root overflowEdgeThreshold={{ xStart: 8 }} />;

// @ts-expect-error `overflowEdgeThreshold` is a number or an object
export const stringThreshold = <ScrollArea.Root overflowEdgeThreshold="8" />;

export const nativeAttributes = (
  <ScrollArea.Root lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const renderSlot = (
  <ScrollArea.Root
    v-slots={{
      render: ({ props, children }: { props: HTMLProps; children: Component }) => (
        <div {...props}>{h(children)}</div>
      ),
    }}
  />
);

type RootSlots = InstanceType<typeof ScrollArea.Root>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<RootSlots['render']>>[0];

expectType<
  { props: HTMLProps; state: ScrollArea.Root.State; children: Component },
  typeof renderSlotProps
>(renderSlotProps);
