import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { LabelIdRoot } from '../../utils/useRegisteredLabelId';
import type { ProgressRootProps, ProgressRootState } from './ProgressRoot.vue';
import * as ProgressRootDataAttributes from './ProgressRootDataAttributes';

export interface ProgressRootContext {
  /**
   * The value clamped to the range. `null` while the progress is indeterminate.
   */
  clampedValue: ComputedRef<number | null>;
  props: Readonly<Pick<ProgressRootProps, 'format' | 'locale' | 'value'>>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  percentageValue: ComputedRef<number | null>;
  labelRoot: LabelIdRoot;
  state: ComputedRef<ProgressRootState>;
}

export const ProgressRootContext: InjectionKey<ProgressRootContext> = Symbol();

export const progressStateAttributesMapping: StateAttributesMapping<ProgressRootState> = {
  status: (value) => ({ [ProgressRootDataAttributes[value]]: '' }),
};

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
