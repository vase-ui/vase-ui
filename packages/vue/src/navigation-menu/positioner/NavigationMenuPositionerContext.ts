import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type NavigationMenuPositionerContext = UseAnchorPositioningReturnValue;

export const NavigationMenuPositionerContext: InjectionKey<NavigationMenuPositionerContext> =
  Symbol();

export function useNavigationMenuPositionerContext(
  optional: true,
): NavigationMenuPositionerContext | undefined;
export function useNavigationMenuPositionerContext(
  optional?: false,
): NavigationMenuPositionerContext;
export function useNavigationMenuPositionerContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NavigationMenuPositionerContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: <NavigationMenu.Positioner> is missing. The popup and the arrow read their side and their alignment from the positioner. Put the part inside <NavigationMenu.Positioner>.',
    );
  }
  return context;
}
