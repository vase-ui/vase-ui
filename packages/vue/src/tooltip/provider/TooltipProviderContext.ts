import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Holds the `delay` of the provider. The delay group holds `closeDelay`.
 */
export type TooltipProviderContext = ComputedRef<number | undefined>;

export const TooltipProviderContext: InjectionKey<TooltipProviderContext> = Symbol();

export function useTooltipProviderContext(): TooltipProviderContext | undefined {
  return inject(TooltipProviderContext, undefined);
}
