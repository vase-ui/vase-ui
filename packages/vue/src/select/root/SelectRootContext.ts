import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { SelectStore } from '../store';

export type SelectRootContext = SelectStore;

export const SelectRootContext: InjectionKey<SelectRootContext> = Symbol();

export function useSelectRootContext(): SelectRootContext {
  const store = inject(SelectRootContext, undefined);
  if (store === undefined) {
    throw new Error(
      'Vase UI: A part of Select must be inside <Select.Root>. Without a root the part has no select state. Put the part inside <Select.Root>.',
    );
  }
  return store;
}
