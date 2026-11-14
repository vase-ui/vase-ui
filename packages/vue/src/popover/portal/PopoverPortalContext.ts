import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export const PopoverPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function usePopoverPortalContext(): ComputedRef<boolean> {
  const value = inject(PopoverPortalContext, undefined);
  if (value === undefined) {
    throw new Error(
      'Vase UI: <Popover.Positioner> must be inside <Popover.Portal>. Without a portal the positioner does not know if the popup stays mounted while it is closed. Put the positioner inside <Popover.Portal>.',
    );
  }
  return value;
}
