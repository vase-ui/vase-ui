import { computed, shallowReactive } from 'vue';
import type { ComputedRef } from 'vue';

/**
 * Registers the `id` of a part with the provider, or removes the registration of the source when
 * `getId` is `undefined`. The provider calls the getter each time it needs the `id`, so the part
 * registers one time and keeps its place in the order of the registrations. A part that registers
 * again after its removal goes to the end. The getter returns `undefined` for a part that has no
 * `id` now, such as a part that `KeepAlive` holds.
 */
export type RegisterId<Id = string> = (
  source: symbol,
  getId: (() => Id | undefined) | undefined,
) => void;

/**
 * Holds the `id`s of the parts of one kind, such as the controls, the labels or the messages of a
 * provider. `ids` has the `id` of each part that has one now, in the order of the registrations.
 *
 * Each part registers one time, by source, and keeps its place. Two parts can have the same `id`,
 * and Vue can mount a part before it unmounts the part that it replaces. A removal by `id` value
 * would then remove the `id` of the new part. A source that registers again after its removal goes
 * to the end. The control registry of a field does this when a control changes.
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
