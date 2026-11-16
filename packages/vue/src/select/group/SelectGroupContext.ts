import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';

export interface SelectGroupContext {
  labelId: ComputedRef<string | undefined>;
  registerLabelId: RegisterId;
}

export const SelectGroupContext: InjectionKey<SelectGroupContext> = Symbol();

export function useSelectGroupContext(): SelectGroupContext {
  const context = inject(SelectGroupContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Select.GroupLabel> must be inside <Select.Group>. Without a group the label has no group to name. Put the label inside <Select.Group>.',
    );
  }
  return context;
}
