import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';

export interface ComboboxGroupContext {
  labelId: Readonly<Ref<string | undefined>>;
  setLabelId: (id: string | undefined) => void;
  /**
   * The items of this group, if the group has a list of items. A collection inside the group
   * renders them.
   */
  items: ComputedRef<readonly any[] | undefined>;
}

export const ComboboxGroupContext: InjectionKey<ComboboxGroupContext> = Symbol();

export function useComboboxGroupContext(): ComboboxGroupContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ComboboxGroupContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Combobox.GroupLabel> must be inside <Combobox.Group>. Without a group the label has no group to name. Put the part inside <Combobox.Group>.',
    );
  }
  return context;
}
