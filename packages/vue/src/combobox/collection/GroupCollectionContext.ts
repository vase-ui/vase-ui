import { inject, provide } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

interface GroupCollectionContext {
  items: ComputedRef<readonly any[]>;
}

const GroupCollectionContext: InjectionKey<GroupCollectionContext> = Symbol();

export function useGroupCollectionContext(): GroupCollectionContext | null {
  return inject(GroupCollectionContext, null);
}

/**
 * Gives the items of a group to the `Combobox.Collection` parts inside it.
 */
export function provideGroupCollectionContext(items: ComputedRef<readonly any[]>): void {
  provide(GroupCollectionContext, { items });
}
