import { expectType } from '#test-utils';
import {
  Progress,
  type ProgressRootProps,
  type ProgressStatus,
  type ProgressValueProps,
  type ProgressValueState,
} from '@vase-ui/vue/progress';

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

// The types of a part are on the part, and the status is on the family, as in Base UI.
const rootProps = null as unknown as Progress.Root.Props;
const valueState = null as unknown as Progress.Value.State;
// A part with no props of its own has `Props` for `as`.
const valueProps = null as unknown as Progress.Value.Props;
const status = null as unknown as Progress.Status;
expectType<ProgressRootProps, typeof rootProps>(rootProps);
expectType<ProgressValueState, typeof valueState>(valueState);
expectType<ProgressValueProps, typeof valueProps>(valueProps);
expectType<'as', keyof ProgressValueProps & 'as'>('as');
expectType<ProgressStatus, typeof status>(status);
