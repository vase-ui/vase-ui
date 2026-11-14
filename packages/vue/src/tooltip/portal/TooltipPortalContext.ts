import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export const TooltipPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useTooltipPortalContext(): ComputedRef<boolean> {
  const value = inject(TooltipPortalContext, undefined);
  if (value === undefined) {
    throw new Error(
      'Vase UI: <Tooltip.Positioner> must be inside <Tooltip.Portal>. Without a portal the positioner does not know if the popup stays mounted while it is closed. Put the positioner inside <Tooltip.Portal>.',
    );
  }
  return value;
}
