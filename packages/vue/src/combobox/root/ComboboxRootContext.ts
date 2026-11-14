import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { ComboboxStore } from '../store';

export interface ComboboxDerivedItemsContext {
  hasItems: ComputedRef<boolean>;
  filteredItems: ComputedRef<any[]>;
  /**
   * The selection values of `filteredItems`, with no groups. They are the items themselves, except
   * when `items` is a collection of `createItems()`.
   */
  flatFilteredValues: ComputedRef<any[]>;
}

/**
 * The value of the input of the combobox, with the type of the `value` of an `<input>`.
 */
export type ComboboxInputValue = string | number | readonly string[] | undefined;

export const ComboboxRootContext: InjectionKey<ComboboxStore> = Symbol();
export const ComboboxDerivedItemsContext: InjectionKey<ComboboxDerivedItemsContext> = Symbol();
export const ComboboxHasItemsContext: InjectionKey<ComputedRef<boolean>> = Symbol();
// The root keeps `inputValue` in `useControlled`. A key of the store would need a watcher that
// copies the value.
export const ComboboxInputValueContext: InjectionKey<ComputedRef<ComboboxInputValue>> = Symbol();

const DEFAULT_COMBOBOX_HAS_ITEMS_CONTEXT = computed(() => false);
const DEFAULT_COMBOBOX_INPUT_VALUE_CONTEXT = computed<ComboboxInputValue>(() => '');

export function useComboboxRootContext(): ComboboxStore {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ComboboxRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Combobox must be inside <Combobox.Root>. Without a root the part has no combobox state. Put the part inside <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxDerivedItemsContext(): ComboboxDerivedItemsContext {
  const context = inject(ComboboxDerivedItemsContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Combobox must be inside <Combobox.Root>. Without a root the part has no filtered items. Put the part inside <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxInputValueContext(): ComputedRef<ComboboxInputValue> {
  return inject(ComboboxInputValueContext, DEFAULT_COMBOBOX_INPUT_VALUE_CONTEXT);
}

export function useComboboxHasItemsContext(): ComputedRef<boolean> {
  return inject(ComboboxHasItemsContext, DEFAULT_COMBOBOX_HAS_ITEMS_CONTEXT);
}
