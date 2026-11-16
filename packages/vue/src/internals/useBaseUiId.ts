import { computed, toValue, useId } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

/**
 * Gives `id`, or `undefined` when `id` is the empty string.
 * HTML requires at least one character in an id, and an ID reference cannot name an empty id. A
 * part thus treats an empty `id` as no `id` (`VUE-93`).
 */
export function givenId<Id extends string | null | undefined>(id: Id): Id | undefined {
  return id === '' ? undefined : id;
}

/**
 * Wraps `useId` and prefixes generated `id`s with `vase-ui-`.
 * Call it in `setup`.
 * @param idOverride Overrides the generated id when it is not `undefined` and not empty.
 * It is a getter, so that the id follows a prop: `useVaseUiId(() => props.id)`.
 */
export function useVaseUiId(
  idOverride?: MaybeRefOrGetter<string | undefined>,
): ComputedRef<string> {
  const generatedId = `vase-ui-${useId()}`;
  return computed(() => givenId(toValue(idOverride)) ?? generatedId);
}
