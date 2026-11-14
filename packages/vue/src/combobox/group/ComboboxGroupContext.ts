import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';

export interface ComboboxGroupContext {
  labelId: ComputedRef<string | undefined>;
  registerLabelId: RegisterId;
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
