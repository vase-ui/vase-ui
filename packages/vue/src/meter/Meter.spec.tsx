import { expectType } from '#test-utils';
import { Meter } from '@vase-ui/vue/meter';

// @ts-expect-error `value` is required.
export const withoutValue = <Meter.Root />;

// @ts-expect-error `value` is never `null`.
export const nullValue = <Meter.Root value={null} />;

// A part takes the native attributes of its element.
export const withAttributes = (
  <Meter.Root value={1} lang="fr" onClick={(event: MouseEvent) => event.preventDefault()}>
    <Meter.Track onClick={(event: MouseEvent) => event.preventDefault()} />
  </Meter.Root>
);

type ValueSlots = InstanceType<typeof Meter.Value>['$slots'];
const defaultSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['default']>>[0];
const elementSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['element']>>[0];

expectType<{ formattedValue: string; value: number }, typeof defaultSlotProps>(defaultSlotProps);
expectType<
  {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    formattedValue: string;
    value: number;
  },
  typeof elementSlotProps
>(elementSlotProps);
