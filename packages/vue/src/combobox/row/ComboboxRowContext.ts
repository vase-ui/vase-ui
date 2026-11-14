import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * Whether the part is inside `Combobox.Row`. A row provides `true`.
 */
export const ComboboxRowContext: InjectionKey<boolean> = Symbol();

export function useComboboxRowContext(): boolean {
  return inject(ComboboxRowContext, false);
}
