import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { DismissElementProps } from '../../utils/popups/types';

/**
 * The props of the dismissal of the list. They are `undefined` while the root has no store of an
 * active trigger.
 */
export const NavigationMenuDismissContext: InjectionKey<
  ComputedRef<DismissElementProps | undefined>
> = Symbol();

export function useNavigationMenuDismissContext() {
  return inject(NavigationMenuDismissContext, undefined);
}
