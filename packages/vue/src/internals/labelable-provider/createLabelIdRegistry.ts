import { computed, shallowRef } from 'vue';
import type { LabelableContext } from './LabelableContext';

/**
 * A provider, or a root that has labels of its own, calls it in `setup`.
 * Each label registers its `id` by source, as each control does.
 * `labelId` is the `id` of the last label that is registered.
 *
 * Two labels can have the same `id`, and Vue can mount a label before it unmounts the label that
 * it replaces. A removal by `id` value would then remove the `id` of the new label.
 */
export function createLabelIdRegistry(): Pick<LabelableContext, 'labelId' | 'registerLabelId'> {
  const registrations = new Map<symbol, string>();
  const registeredLabelId = shallowRef<string | undefined>();

  function registerLabelId(source: symbol, nextId: string | undefined) {
    if (nextId === undefined) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }

    registeredLabelId.value = Array.from(registrations.values()).at(-1);
  }

  return { labelId: computed(() => registeredLabelId.value), registerLabelId };
}
