import { computed, shallowReactive } from 'vue';
import type { ComputedRef } from 'vue';
import type { RegisterId } from './LabelableContext';

/**
 * Holds the `id`s of the parts of one kind, such as the controls, the labels or the messages of a
 * provider. `ids` has the `id` of each part that has one now, in the order of the registrations.
 *
 * Each part registers one time, by source, and keeps its place. Two parts can have the same `id`,
 * and Vue can mount a part before it unmounts the part that it replaces. A removal by `id` value
 * would then remove the `id` of the new part.
 */
export function createIdRegistry<Id = string>(): {
  ids: ComputedRef<Id[]>;
  registerId: RegisterId<Id>;
} {
  const getters = shallowReactive(new Map<symbol, () => Id | undefined>());

  const ids = computed(() => {
    const result: Id[] = [];
    for (const getId of getters.values()) {
      const id = getId();
      if (id !== undefined) {
        result.push(id);
      }
    }
    return result;
  });

  const registerId: RegisterId<Id> = (source, getId) => {
    if (getId === undefined) {
      getters.delete(source);
    } else {
      getters.set(source, getId);
    }
  };

  return { ids, registerId };
}
