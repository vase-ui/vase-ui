import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../common/hydration';
import { useVaseUiId } from '../internals/useBaseUiId';

export type LabelIdSetter = (
  next: string | undefined | ((current: string | undefined) => string | undefined),
) => void;

export interface UseLabelIdReturnValue {
  /** The id of the label that the root has now. */
  labelId: ComputedRef<string | undefined>;
  /** The id of a label that has no `id` of its own. */
  defaultLabelId: ComputedRef<string>;
  setLabelId: LabelIdSetter;
  /**
   * Gives the `aria-labelledby` of the root. The root calls it with the attributes of the consumer,
   * in the function that it gives to `useRenderElement` as `props`.
   */
  getAriaLabelledBy: (attrs: Record<string, unknown>) => string | undefined;
}

/**
 * The root of a part with a label calls it.
 *
 * A server writes the attributes of the root before the `setup` of a label inside the root. A
 * deferral of the root moves its attributes and that `setup` together, so the label cannot register
 * its id in time. The root makes the id of the label instead. It assumes a label until it is
 * mounted, unless the consumer gives the root a non-blank `aria-label`. An `aria-labelledby` of the
 * consumer wins, because the attributes of the consumer merge last.
 *
 * The first render in a browser assumes the same as a server. Vue does not patch an attribute when
 * it hydrates. A root that assumes a label only on a server keeps the generated id in the DOM.
 */
export function useLabelId(): UseLabelIdReturnValue {
  const defaultLabelId = useVaseUiId();
  const isHydrating = useIsHydrating();
  const registeredId = shallowRef<string | undefined>();

  const setLabelId: LabelIdSetter = (next) => {
    registeredId.value = typeof next === 'function' ? next(registeredId.value) : next;
  };

  function getAriaLabelledBy(attrs: Record<string, unknown>) {
    if (registeredId.value !== undefined || !isHydrating.value || hasAriaLabel(attrs)) {
      return registeredId.value;
    }
    return defaultLabelId.value;
  }

  return {
    labelId: computed(() => registeredId.value),
    defaultLabelId,
    setLabelId,
    getAriaLabelledBy,
  };
}

function hasAriaLabel(attrs: Record<string, unknown>) {
  const ariaLabel = attrs['aria-label'];
  return typeof ariaLabel === 'string' && ariaLabel.trim() !== '';
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
