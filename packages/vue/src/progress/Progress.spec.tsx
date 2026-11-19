import { expectType } from '#test-utils';
import { Progress, type ProgressValueState } from '@vase-ui/vue/progress';

const onClick = (event: MouseEvent) => event.preventDefault();

// Each part takes the native attributes and listeners of its element, and `value` is optional.
export const withAttributes = (
  <Progress.Root lang="fr" onClick={onClick}>
    <Progress.Label lang="fr" onClick={onClick} />
    <Progress.Value lang="fr" onClick={onClick} />
    <Progress.Track lang="fr" onClick={onClick}>
      <Progress.Indicator lang="fr" onClick={onClick} />
    </Progress.Track>
  </Progress.Root>
);

// @ts-expect-error `lang` is a string.
export const wrongAttribute = <Progress.Track lang={5} />;

type ValueSlots = InstanceType<typeof Progress.Value>['$slots'];
const defaultSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['default']>>[0];
const elementSlotProps = null as unknown as Parameters<NonNullable<ValueSlots['element']>>[0];

expectType<
  { formattedValue: string | null; value: number | null; state: ProgressValueState },
  typeof defaultSlotProps
>(defaultSlotProps);
expectType<
  {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressValueState;
    formattedValue: string | null;
    value: number | null;
  },
  typeof elementSlotProps
>(elementSlotProps);
