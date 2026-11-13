import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { CheckboxRootState } from './CheckboxRoot.vue';

export type CheckboxRootContext = ComputedRef<CheckboxRootState>;

export const CheckboxRootContext: InjectionKey<CheckboxRootContext> = Symbol();

export function useCheckboxRootContext(): CheckboxRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CheckboxRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Checkbox must be inside <Checkbox.Root>. Without a root the part has no state to show. Put the part inside <Checkbox.Root>.',
    );
  }

  return context;
}
