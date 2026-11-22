import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';

/** What `Menu.RadioGroup` gives to its items. The properties are reactive. */
export interface MenuRadioGroupForItem {
  readonly value: unknown;
  readonly disabled: boolean;
  /** Checks the item with the value after a press. */
  select(value: unknown, event: Event): void;
}

export const radioGroupKey: InjectionKey<MenuRadioGroupForItem> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'menu radio group' : undefined,
);

/** The group of a radio item. An item with no group throws an error. */
export function injectRadioGroup() {
  const group = inject(radioGroupKey, null);
  if (!group) {
    throw createError(33);
  }
  return group;
}
