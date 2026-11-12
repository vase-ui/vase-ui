import { h } from 'vue';
import type { Component } from 'vue';
import { Progress, ProgressRootDataAttributes } from '@vase-ui/vue/progress';
import type { ProgressRootProps, ProgressRootState, ProgressStatus } from '@vase-ui/vue/progress';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: Progress.Root.Props = {
  value: 30,
  min: 0,
  max: 100,
  locale: 'de-DE',
  format: { style: 'percent' },
  getAriaValueText: (formattedValue, value) => `${formattedValue} ${value}`,
} satisfies ProgressRootProps;
export const state: Progress.Root.State = { status: 'progressing' } satisfies ProgressRootState;
export const status: Progress.Status = 'complete' satisfies ProgressStatus;
export const attribute: 'data-complete' = ProgressRootDataAttributes.complete;

export const indeterminate = <Progress.Root value={null} />;

// @ts-expect-error `value` is required
export const withoutValue = <Progress.Root />;

// `aria-valuetext` is a native attribute, so it comes with the other attributes of the element.
export const nativeAttributes = (
  <Progress.Root
    value={1}
    aria-valuetext="one"
    lang="fr"
    onClick={(event) => event.preventVaseUIHandler()}
  />
);

export const renderSlot = (
  <Progress.Root
    value={1}
    v-slots={{
      render: ({ props, children }: { props: HTMLProps; children: Component }) => (
        <div {...props}>{h(children)}</div>
      ),
    }}
  />
);

type RootSlots = InstanceType<typeof Progress.Root>['$slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<RootSlots['render']>>[0];

expectType<
  { props: HTMLProps; state: Progress.Root.State; children: Component },
  typeof renderSlotProps
>(renderSlotProps);
