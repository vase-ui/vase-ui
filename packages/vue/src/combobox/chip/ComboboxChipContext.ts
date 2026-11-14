import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface ComboboxChipContext {
  index: ComputedRef<number>;
}

export const ComboboxChipContext: InjectionKey<ComboboxChipContext> = Symbol();

export function useComboboxChipContext(): ComboboxChipContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ComboboxChipContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Combobox.ChipRemove> must be inside <Combobox.Chip>. Without a chip the button has no value to remove. Put the part inside <Combobox.Chip>.',
    );
  }
  return context;
}
