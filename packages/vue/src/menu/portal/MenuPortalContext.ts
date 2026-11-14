import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export const MenuPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useMenuPortalContext(): ComputedRef<boolean> {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const value = inject(MenuPortalContext, undefined);
  if (value === undefined) {
    throw new Error(
      'Vase UI: <Menu.Positioner> must be inside <Menu.Portal>. Without a portal the positioner does not know if it stays mounted. Put the positioner inside <Menu.Portal>.',
    );
  }

  return value;
}
