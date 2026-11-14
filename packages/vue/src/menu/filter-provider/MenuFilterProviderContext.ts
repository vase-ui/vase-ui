import type { InjectionKey } from 'vue';
import type { MenuFilterRoot } from '../filter-root/MenuFilterRoot';

/**
 * What `Menu.FilterProvider` gives to the root directly inside it: the function that makes the
 * root filterable. The provider is the only importer of the code behind it.
 */
export interface MenuFilterProviderContext {
  /** Makes the filterable parts of the root. Its options follow the props of the provider. */
  useRoot: () => MenuFilterRoot;
}

/**
 * Non-null only directly below a provider. The root that consumes it resets it, so a plain
 * `Menu.SubmenuRoot` inside a filterable menu stays plain.
 */
export const MenuFilterProviderContext: InjectionKey<MenuFilterProviderContext | null> = Symbol();
