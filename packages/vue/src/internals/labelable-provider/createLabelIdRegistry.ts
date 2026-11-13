import { computed } from 'vue';
import type { LabelableContext } from './LabelableContext';
import { createIdRegistry } from './createIdRegistry';

/**
 * A provider, or a root that has labels of its own, calls it in `setup`.
 * `labelId` is the `id` of the last label that has one.
 */
export function createLabelIdRegistry(): Pick<LabelableContext, 'labelId' | 'registerLabelId'> {
  const { ids, registerId } = createIdRegistry();

  return { labelId: computed(() => ids.value.at(-1)), registerLabelId: registerId };
}
