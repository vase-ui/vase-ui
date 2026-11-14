import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { MenuCheckboxItemState } from './MenuCheckboxItem.vue';

export type MenuCheckboxItemContext = ComputedRef<MenuCheckboxItemState>;

export const MenuCheckboxItemContext: InjectionKey<MenuCheckboxItemContext> = Symbol();

export function useMenuCheckboxItemContext() {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenuCheckboxItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.CheckboxItemIndicator> must be inside <Menu.CheckboxItem>. Without an item the indicator has no checked state to show. Put the indicator inside <Menu.CheckboxItem>.',
    );
  }

  return context;
}
