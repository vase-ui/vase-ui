import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../common/hydration';
import { useVaseUiId } from '../internals/useBaseUiId';

export type LabelIdSetter = (
  next: string | undefined | ((current: string | undefined) => string | undefined),
) => void;

export interface UseLabelIdReturnValue {
  /** The id for `aria-labelledby` of the root. */
  labelId: ComputedRef<string | undefined>;
  /** The id of a label that has no `id` of its own. */
  defaultLabelId: ComputedRef<string>;
  setLabelId: LabelIdSetter;
}

/**
 * The root of a part with a label calls it.
 *
 * A server render writes the attributes of the root before the `setup` of a label runs. A label
 * cannot register its id in time for the server HTML. So the root makes the id of the label, and it
 * assumes a label until it is mounted.
 */
export function useLabelId(): UseLabelIdReturnValue {
  const defaultLabelId = useVaseUiId();
  const isHydrating = useIsHydrating();
  const registeredId = shallowRef<string | undefined>();

  const setLabelId: LabelIdSetter = (next) => {
    registeredId.value = typeof next === 'function' ? next(registeredId.value) : next;
  };

  const labelId = computed(
    () => registeredId.value ?? (isHydrating.value ? defaultLabelId.value : undefined),
  );

  return { labelId, defaultLabelId, setLabelId };
}

/**
 * The label calls it. It gives the id of the label to the root.
 * @param idProp The `id` of the consumer. It wins over `defaultLabelId`.
 * @param setLabelId The setter that `useLabelId` returns.
 * @param defaultLabelId The id that the root made, so that the id equals the id in the server HTML.
 * @returns The id of the label.
 */
export function useRegisteredLabelId(
  idProp: MaybeRefOrGetter<string | undefined>,
  setLabelId: LabelIdSetter,
  defaultLabelId: MaybeRefOrGetter<string>,
): ComputedRef<string> {
  const id = computed(() => toValue(idProp) ?? toValue(defaultLabelId));

  setLabelId(id.value);
  watch(id, (next) => {
    setLabelId(next);
  });
  onScopeDispose(() => {
    setLabelId((current) => (current === id.value ? undefined : current));
  });

  return id;
}
