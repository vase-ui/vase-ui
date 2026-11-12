import { h } from 'vue';
import type { Component } from 'vue';
import { Meter } from '@vase-ui/vue/meter';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const defaultSlot = (
  <Meter.Value
    v-slots={{
      default: ({ formattedValue, value }: { formattedValue: string; value: number }) =>
        `${formattedValue} ${value}`,
    }}
  />
);

export const renderSlot = (
  <Meter.Value
    v-slots={{
      render: ({ props, children }: { props: HTMLProps; children: Component }) => (
        <span {...props}>{h(children)}</span>
      ),
    }}
  />
);

type ValueSlots = InstanceType<typeof Meter.Value>['$slots'];
const defaultSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['default']>>[0];
const renderSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['render']>>[0];

expectType<
  { formattedValue: string; value: number; state: Meter.Value.State },
  typeof defaultSlotProps
>(defaultSlotProps);
expectType<
  { props: HTMLProps; state: Meter.Value.State; children: Component },
  typeof renderSlotProps
>(renderSlotProps);
