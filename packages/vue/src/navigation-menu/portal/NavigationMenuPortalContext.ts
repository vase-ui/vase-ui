import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Whether the portal keeps the popup in the DOM while the popup is closed.
 */
export const NavigationMenuPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useNavigationMenuPortalContext() {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const keepMounted = inject(NavigationMenuPortalContext, undefined);
  if (keepMounted === undefined) {
    throw new Error(
      'Vase UI: <NavigationMenu.Portal> is missing. The positioner reads from the portal whether the popup stays in the DOM while it is closed. Put <NavigationMenu.Positioner> inside <NavigationMenu.Portal>.',
    );
  }
  return keepMounted;
}
