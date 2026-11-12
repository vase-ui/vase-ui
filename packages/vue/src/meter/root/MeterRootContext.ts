import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { LabelIdSetter } from '../../utils/useRegisteredLabelId';

export interface MeterRootContext {
  /**
   * The value clamped to the range.
   */
  clampedValue: ComputedRef<number>;
  format: ComputedRef<Intl.NumberFormatOptions | undefined>;
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   */
  percentageValue: ComputedRef<number>;
  value: ComputedRef<number>;
  setLabelId: LabelIdSetter;
  defaultLabelId: ComputedRef<string>;
}

export const MeterRootContext: InjectionKey<MeterRootContext> = Symbol();

export function useMeterRootContext(): MeterRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(MeterRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Meter must be inside <Meter.Root>. Without a root the part has no value to show. Put the part inside <Meter.Root>.',
    );
  }

  return context;
}
