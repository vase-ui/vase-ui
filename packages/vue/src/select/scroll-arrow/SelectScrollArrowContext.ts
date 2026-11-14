import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * The direction of the scroll arrow. The `children` component shows the arrow of that direction.
 */
export type SelectScrollArrowContext = ComputedRef<'up' | 'down'>;

export const SelectScrollArrowContext: InjectionKey<SelectScrollArrowContext> = Symbol();

export function useSelectScrollArrowContext(): SelectScrollArrowContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(SelectScrollArrowContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of a scroll arrow must be inside <Select.ScrollUpArrow> or <Select.ScrollDownArrow>. Without the part it has no direction to show. Mount the `children` component in the element of the `#render` slot of the scroll arrow.',
    );
  }

  return context;
}
