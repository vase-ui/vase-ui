import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface ToolbarGroupContext {
  disabled: ComputedRef<boolean>;
}

export const ToolbarGroupContext: InjectionKey<ToolbarGroupContext> = Symbol();

export function useToolbarGroupContext(): ToolbarGroupContext | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // An item with no group is valid, so this function does not throw.
  return inject(ToolbarGroupContext, undefined);
}
