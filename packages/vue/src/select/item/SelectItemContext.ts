import { inject } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';

export interface SelectItemContext {
  selected: ComputedRef<boolean>;
  index: ComputedRef<number>;
  textRef: ShallowRef<HTMLElement | null>;
  selectedByFocus: ComputedRef<boolean>;
}

export const SelectItemContext: InjectionKey<SelectItemContext> = Symbol();

export function useSelectItemContext(): SelectItemContext {
  const context = inject(SelectItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A text or an indicator of a Select item must be inside <Select.Item>. Without an item the part has no selected state. Put the part inside <Select.Item>.',
    );
  }
  return context;
}
