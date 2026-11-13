import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface FieldItemContext {
  disabled: ComputedRef<boolean>;
}

export const FieldItemContext: InjectionKey<FieldItemContext> = Symbol();

// All apps and all server requests share this object, so it holds no state.
const DEFAULT_FIELD_ITEM_CONTEXT: FieldItemContext = { disabled: computed(() => false) };

/**
 * Gives the context of the nearest item, or a context of an item that is not disabled when there is
 * none.
 */
export function useFieldItemContext(): FieldItemContext {
  return inject(FieldItemContext, DEFAULT_FIELD_ITEM_CONTEXT);
}
