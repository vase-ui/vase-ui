import { inject, type InjectionKey } from 'vue';

/** What `Menu.RadioGroup` gives to its items. The properties are reactive. */
export interface MenuRadioGroupForItem {
  readonly value: unknown;
  readonly disabled: boolean;
  /** Checks the item with the value after a press. */
  select(value: unknown, event: Event): void;
}

export const radioGroupKey: InjectionKey<MenuRadioGroupForItem> = Symbol('menu radio group');

/** The group of a radio item. An item with no group throws an error. */
export function injectRadioGroup() {
  const group = inject(radioGroupKey, null);
  if (!group) {
    throw new Error(
      'Vase UI: <Menu.RadioItem> must be inside <Menu.RadioGroup>. Without a group the item has no value to check. Put the item inside <Menu.RadioGroup>.',
    );
  }
  return group;
}
