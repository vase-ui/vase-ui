import { shallowRef } from 'vue';
import { provideMenuFilterDropdown } from './MenuFilterDropdown';
import type { MenuFilterRoot, MenuFilterRootOptions } from './MenuFilterRoot';

/**
 * Splits the options of a filterable root between the menu root and the filter below it. Call it
 * in `setup`, through the provider.
 */
export function useMenuFilterRoot(options: MenuFilterRootOptions): MenuFilterRoot {
  // The input of the menu writes the element that holds real focus.
  const focusOwnerRef = shallowRef<HTMLElement | null>(null);

  return {
    rootOptions: {
      virtualFocus: true,
      virtualFocusRef: focusOwnerRef,
      allowEscape: () => !options.autoHighlight(),
      resetOnPointerLeave: () => options.autoHighlight() !== 'always',
    },
    provideDropdown(context) {
      provideMenuFilterDropdown(context, { ...options, focusOwnerRef });
    },
  };
}
