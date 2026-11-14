import type { MenuRootContext } from '../root/MenuRootContext';
import type { UseMenuRootOptions } from '../root/useMenuRoot';
import type { MenuFilterDropdownParameters } from './MenuFilterDropdown';

/** The options of the filterable menu. Each one follows the props of `Menu.FilterProvider`. */
export type MenuFilterRootOptions = Omit<MenuFilterDropdownParameters, 'focusOwnerRef'>;

/**
 * The work that a filterable `Menu.Root` does in addition to the work of a plain one. The
 * provider gives it to the root directly inside it. Only the provider imports the code behind it,
 * so a plain menu never bundles it.
 */
export interface MenuFilterRoot {
  /** The options of `useMenuRoot` that a filterable menu sets. */
  rootOptions: Pick<
    UseMenuRootOptions,
    'virtualFocus' | 'virtualFocusRef' | 'allowEscape' | 'resetOnPointerLeave'
  >;
  /**
   * Provides the filter to the parts of the menu. The root calls it with the context that
   * `useMenuRoot` returned, because a component cannot inject what it provides.
   */
  provideDropdown: (context: MenuRootContext) => void;
}
