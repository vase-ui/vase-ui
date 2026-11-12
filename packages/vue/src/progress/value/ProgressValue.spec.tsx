import { h } from 'vue';
import type { Component } from 'vue';
import { Progress, ProgressValueDataAttributes } from '@vase-ui/vue/progress';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const attribute: 'data-indeterminate' = ProgressValueDataAttributes.indeterminate;

export const defaultSlot = (
  <Progress.Value
    v-slots={{
      default: ({
        formattedValue,
        value,
      }: {
        formattedValue: string | null;
        value: number | null;
      }) => `${formattedValue} ${value}`,
    }}
  />
);

export const renderSlot = (
  <Progress.Value
    v-slots={{
      render: ({ props, children }: { props: HTMLProps; children: Component }) => (
        <span {...props}>{h(children)}</span>
      ),
    }}
  />
);

type ValueSlots = InstanceType<typeof Progress.Value>['$slots'];
const defaultSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['default']>>[0];
const renderSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['render']>>[0];

expectType<
  { formattedValue: string | null; value: number | null; state: Progress.Value.State },
  typeof defaultSlotProps
>(defaultSlotProps);
expectType<
  { props: HTMLProps; state: Progress.Value.State; children: Component },
  typeof renderSlotProps
>(renderSlotProps);
