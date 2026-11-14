import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { VaseUIEvent } from '../../internals/types';

export interface MenuSubmenuRootContext {
  /** The element that gets the focus when a key closes the submenu. */
  getReturnElement?: (() => HTMLElement | null) | undefined;
  onTriggerKeydown?: ((event: VaseUIEvent<KeyboardEvent>) => void) | undefined;
  onPopupKeydown?: ((event: KeyboardEvent) => void) | undefined;
}

/**
 * A plain submenu root provides an empty value, so that a part in it does not read the value of
 * a filterable submenu around it.
 */
export const MenuSubmenuRootContext: InjectionKey<MenuSubmenuRootContext | undefined> = Symbol();

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  return inject(MenuSubmenuRootContext, undefined);
}
