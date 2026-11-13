import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RadioRootState } from './RadioRoot.vue';

export type RadioRootContext = ComputedRef<RadioRootState>;

export const RadioRootContext: InjectionKey<RadioRootContext> = Symbol();

export function useRadioRootContext(): RadioRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(RadioRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Radio must be inside <Radio.Root>. Without a root the part has no state to show. Put the part inside <Radio.Root>.',
    );
  }

  return context;
}
