import { inject } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';

export interface ComboboxChipsContext {
  chipsRef: ShallowRef<(HTMLButtonElement | null)[]>;
}

export const ComboboxChipsContext: InjectionKey<ComboboxChipsContext> = Symbol();

export function useComboboxChipsContext(): ComboboxChipsContext | undefined {
  // The default `undefined` stops the Vue warning for a missing provider. The input reads the
  // context, and an input with no chips is valid.
  return inject(ComboboxChipsContext, undefined);
}
