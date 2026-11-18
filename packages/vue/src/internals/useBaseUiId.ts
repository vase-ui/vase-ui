import { computed, toValue, useId } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { given } from './givenAttributes';

/**
 * Wraps `useId` and prefixes generated `id`s with `vase-ui-`.
 * Call it in `setup`.
 * @param idOverride An optional id. The generated id applies when the value is `undefined`, empty,
 * or white space only. Use a getter to follow a prop, such as `useVaseUiId(() => props.id)`.
 */
export function useVaseUiId(
  idOverride?: MaybeRefOrGetter<string | undefined>,
): ComputedRef<string> {
  const generatedId = `vase-ui-${useId()}`;
  return computed(() => given('id', toValue(idOverride)) ?? generatedId);
}
