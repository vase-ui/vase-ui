import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface CSPContextValue {
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}

export const CSPContext: InjectionKey<ComputedRef<CSPContextValue>> = Symbol();

const DEFAULT_CSP_CONTEXT_VALUE: CSPContextValue = {
  disableStyleElements: false,
};

/**
 * Gives the settings of the nearest `CSPProvider`, or the defaults when there is none.
 * Call it in `setup`. Read `.value` where the code uses the value.
 * `setup` runs one time, so a copy of the value in `setup` does not follow a change of a prop.
 */
export function useCSPContext(): ComputedRef<CSPContextValue> {
  // `undefined` as the default stops the Vue warning for a missing provider.
  // A part with no provider above it is normal.
  const context = inject(CSPContext, undefined);
  return computed(() => context?.value ?? DEFAULT_CSP_CONTEXT_VALUE);
}
