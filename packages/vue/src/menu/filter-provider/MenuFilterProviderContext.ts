import type { InjectionKey } from 'vue';
import type { MenuFilterSubmenuRoot } from '../filter-submenu-root/MenuFilterSubmenuRoot';
import type { MenuFilterRoot } from '../filter-root/MenuFilterRoot';

/**
 * What `Menu.FilterProvider` gives to the root directly inside it: the functions that make the
 * root or the submenu root filterable. The provider is the only importer of the code behind them.
 */
export interface MenuFilterProviderContext {
  /** Makes the filterable parts of a root. Its options follow the props of the provider. */
  useRoot: () => MenuFilterRoot;
  /** Makes the filterable parts of a submenu root. Its options follow the props of the provider. */
  useSubmenuRoot: () => MenuFilterSubmenuRoot;
}

/**
 * Non-null only directly below a provider. The root that consumes it resets it, so a plain
 * `Menu.SubmenuRoot` inside a filterable menu stays plain.
 */
export const MenuFilterProviderContext: InjectionKey<MenuFilterProviderContext | null> = Symbol();
