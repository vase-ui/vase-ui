import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { ItemLabel } from '../../internals/resolveValueLabel';

export interface SelectValueContext {
  /**
   * The value of the select. The default slot of the consumer gets it.
   */
  value: ComputedRef;
  /**
   * The labels that the part shows when the consumer gives no default slot: the placeholder, the
   * label of the value, or the labels of the values with `', '` between them. No label is empty.
   */
  labels: ComputedRef<NonNullable<ItemLabel>[]>;
}

export const SelectValueContext: InjectionKey<SelectValueContext> = Symbol();

export function useSelectValueContext(): SelectValueContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(SelectValueContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Select.Value> must be inside <Select.Value>. Without the part it has no value to show. Mount the `children` component in the element of the `#render` slot of <Select.Value>.',
    );
  }

  return context;
}
