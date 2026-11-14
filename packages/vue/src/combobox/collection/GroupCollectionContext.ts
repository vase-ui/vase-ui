import { computed, inject, provide } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

interface GroupCollectionContext {
  /**
   * The items of the nearest group that has `items`, or `undefined` when no group around the
   * collection has them.
   */
  items: ComputedRef<readonly any[] | undefined>;
}

const GroupCollectionContext: InjectionKey<GroupCollectionContext> = Symbol();

export function useGroupCollectionContext(): GroupCollectionContext | null {
  return inject(GroupCollectionContext, null);
}

/**
 * Gives the items of a group to the `Combobox.Collection` parts inside it. Base UI provides no
 * context for a group with no `items`, so such a group gives the items of the group around it.
 */
export function provideGroupCollectionContext(items: () => readonly any[] | undefined): void {
  const parent = useGroupCollectionContext();
  provide(GroupCollectionContext, { items: computed(() => items() ?? parent?.items.value) });
}
