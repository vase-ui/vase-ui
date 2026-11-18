import { inject } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';
import type { CompositeListContextValue } from '../../internals/composite/list/useCompositeList';

export interface ComboboxChipsContext {
  chipsRef: ShallowRef<(HTMLButtonElement | null)[]>;
  /**
   * The list of the chips. The chips register with it through this context. The chips part does
   * not provide the list, so an item of a composite around the chips part joins that composite.
   */
  chipList: CompositeListContextValue<unknown>;
}

export const ComboboxChipsContext: InjectionKey<ComboboxChipsContext> = Symbol();

export function useComboboxChipsContext(): ComboboxChipsContext | undefined {
  // The default `undefined` stops the Vue warning for a missing provider. The input reads the
  // context, and an input with no chips is valid.
  return inject(ComboboxChipsContext, undefined);
}
