import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { createIdRegistry, type RegisterId } from './createIdRegistry';

/**
 * A root that has labels of its own calls it in `setup`. `labelId` is the `id` of the last label
 * that has one.
 */
export function createLabelIdRegistry(): {
  labelId: ComputedRef<string | undefined>;
  registerLabelId: RegisterId;
} {
  const { ids, registerId } = createIdRegistry();

  return { labelId: computed(() => ids.value.at(-1)), registerLabelId: registerId };
}
