import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { DismissLayer } from '../../utils/popups/interactions/useDismissLayer';

/**
 * The props of the dismissal of the list. They are `undefined` while the root has no store of an
 * active trigger.
 */
export const NavigationMenuDismissContext: InjectionKey<ComputedRef<DismissLayer | undefined>> =
  Symbol();

export function useNavigationMenuDismissContext() {
  return inject(NavigationMenuDismissContext, undefined);
}
