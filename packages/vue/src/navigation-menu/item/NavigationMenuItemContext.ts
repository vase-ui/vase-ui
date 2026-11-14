import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface NavigationMenuItemContextValue {
  value: ComputedRef<any>;
}

export const NavigationMenuItemContext: InjectionKey<NavigationMenuItemContextValue> = Symbol();

export function useNavigationMenuItemContext() {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NavigationMenuItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <NavigationMenu.Item> is missing. A trigger, a content and an icon read the value of their item. Put the part inside <NavigationMenu.Item>.',
    );
  }
  return context;
}
