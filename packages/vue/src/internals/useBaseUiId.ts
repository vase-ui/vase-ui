import { computed, toValue, useId } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

/**
 * Wraps `useId` and prefixes generated `id`s with `vase-ui-`.
 * Call it in `setup`.
 * @param idOverride Overrides the generated id when it is not `undefined`.
 * It is a getter, so that the id follows a prop: `useVaseUiId(() => props.id)`.
 */
export function useVaseUiId(
  idOverride?: MaybeRefOrGetter<string | undefined>,
): ComputedRef<string> {
  const generatedId = `vase-ui-${useId()}`;
  return computed(() => toValue(idOverride) ?? generatedId);
}
