import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { MenuRootChangeEventDetails } from '../root/MenuRoot.vue';

export interface MenuRadioGroupContext {
  value: ComputedRef<any>;
  setValue: (newValue: any, eventDetails: MenuRootChangeEventDetails) => void;
  disabled: ComputedRef<boolean>;
}

export const MenuRadioGroupContext: InjectionKey<MenuRadioGroupContext> = Symbol();

export function useMenuRadioGroupContext() {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenuRadioGroupContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.RadioItem> must be inside <Menu.RadioGroup>. Without a group the item has no value to select. Put the item inside <Menu.RadioGroup>.',
    );
  }

  return context;
}
