import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';

export interface SelectGroupContext {
  labelId: ComputedRef<string | undefined>;
  registerLabelId: RegisterId;
  /** Whether an id reference of the group reaches `element`. */
  reaches: (element: Element) => boolean;
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
