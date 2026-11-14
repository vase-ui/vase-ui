import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { MenuRadioItemState } from './MenuRadioItem.vue';

export type MenuRadioItemContext = ComputedRef<MenuRadioItemState>;

export const MenuRadioItemContext: InjectionKey<MenuRadioItemContext> = Symbol();

export function useMenuRadioItemContext() {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenuRadioItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.RadioItemIndicator> must be inside <Menu.RadioItem>. Without an item the indicator has no selected state to show. Put the indicator inside <Menu.RadioItem>.',
    );
  }

  return context;
}
