import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { LabelIdSetter } from '../../utils/useRegisteredLabelId';
import type { ProgressRootState } from './ProgressRoot.vue';

export interface ProgressRootContext {
  /**
   * The value clamped to the range. `null` while the progress is indeterminate.
   */
  clampedValue: ComputedRef<number | null>;
  format: ComputedRef<Intl.NumberFormatOptions | undefined>;
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  percentageValue: ComputedRef<number | null>;
  /**
   * Value of the component.
   */
  value: ComputedRef<number | null>;
  setLabelId: LabelIdSetter;
  defaultLabelId: ComputedRef<string>;
  state: ComputedRef<ProgressRootState>;
}

export const ProgressRootContext: InjectionKey<ProgressRootContext> = Symbol();

export function useProgressRootContext(): ProgressRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ProgressRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Progress must be inside <Progress.Root>. Without a root the part has no value and no status to show. Put the part inside <Progress.Root>.',
    );
  }

  return context;
}
