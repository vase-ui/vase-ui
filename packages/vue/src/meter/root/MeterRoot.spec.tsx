import { h } from 'vue';
import type { Component } from 'vue';
import { Meter } from '@vase-ui/vue/meter';
import type { MeterRootProps, MeterRootState } from '@vase-ui/vue/meter';
import type { HTMLProps } from '@vase-ui/vue/types';
import { expectType } from '#test-utils';

export const props: Meter.Root.Props = {
  value: 30,
  min: 0,
  max: 100,
  locale: 'de-DE',
  format: { style: 'percent' },
  getAriaValueText: (formattedValue, value) => `${formattedValue} ${value}`,
} satisfies MeterRootProps;
export const state: Meter.Root.State = {} satisfies MeterRootState;

// @ts-expect-error `value` is required
export const withoutValue = <Meter.Root />;

// @ts-expect-error `value` is never `null`
export const nullValue = <Meter.Root value={null} />;

// `aria-valuetext` is a native attribute, so it comes with the other attributes of the element.
export const nativeAttributes = (
  <Meter.Root
    value={1}
    aria-valuetext="one"
    lang="fr"
    onClick={(event) => event.preventVaseUIHandler()}
  />
);

export const renderSlot = (
  <Meter.Root
    value={1}
    v-slots={{
      render: ({ props, children }: { props: HTMLProps; children: Component }) => (
        <div {...props}>{h(children)}</div>
      ),
    }}
  />
);

type RootSlots = InstanceType<typeof Meter.Root>['$slots'];
const defaultSlotProps = null as unknown as Parameters<NonNullable<RootSlots['default']>>[0];
const renderSlotProps = null as unknown as Parameters<NonNullable<RootSlots['render']>>[0];

expectType<{ state: Meter.Root.State }, typeof defaultSlotProps>(defaultSlotProps);
expectType<
  { props: HTMLProps; state: Meter.Root.State; children: Component },
  typeof renderSlotProps
>(renderSlotProps);
