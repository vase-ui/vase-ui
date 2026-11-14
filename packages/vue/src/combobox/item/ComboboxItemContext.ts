import { inject } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';

export interface ComboboxItemContext {
  selected: ComputedRef<boolean>;
  textRef: ShallowRef<HTMLElement | null>;
}

export const ComboboxItemContext: InjectionKey<ComboboxItemContext> = Symbol();

export function useComboboxItemContext(): ComboboxItemContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ComboboxItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Combobox.ItemIndicator> must be inside <Combobox.Item>. Without an item the indicator has no selected state. Put the part inside <Combobox.Item>.',
    );
  }
  return context;
}
