import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { SwitchRootState } from './SwitchRoot.vue';

export type SwitchRootContext = ComputedRef<SwitchRootState>;

export const SwitchRootContext: InjectionKey<SwitchRootContext> = Symbol();

export function useSwitchRootContext(): SwitchRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(SwitchRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Switch must be inside <Switch.Root>. Without a root the part has no state to show. Put the part inside <Switch.Root>.',
    );
  }

  return context;
}
