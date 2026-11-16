import { computed, onMounted, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../common/hydration';
import { given } from '../internals/givenAttributes';
import { useReferencedId } from '../internals/labelable-provider/useRegisteredId';
import { useVaseUiId } from '../internals/useBaseUiId';
import { useKeepAliveState } from '../internals/useKeepAliveState';

export type LabelIdSetter = (
  next: string | undefined | ((current: string | undefined) => string | undefined),
) => void;

interface ShownLabel {
  id: () => string | undefined;
  element: () => Element | null | undefined;
}

/** What a label needs from its root. `useLabelId` makes it. */
export interface LabelIdRoot {
  setLabelId: LabelIdSetter;
  defaultLabelId: ComputedRef<string>;
  isMounted: () => boolean;
  /**
   * Queues a label that `KeepAlive` shows. The root names the last queued label in the document,
   * one time for each flush.
   */
  show: (label: ShownLabel) => void;
}

export interface UseLabelIdReturnValue {
  /** The id of the label that the root has now. */
  labelId: ComputedRef<string | undefined>;
  labelRoot: LabelIdRoot;
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
 * mounted, unless the consumer gives the root a non-blank `aria-label`. A non-blank
 * `aria-labelledby` of the consumer wins, because the attributes of the consumer merge last.
 *
 * The first render in a browser assumes the same as a server. Vue does not patch an attribute when
 * it hydrates. A root that assumes a label only on a server keeps the generated id in the DOM.
 */
export function useLabelId(): UseLabelIdReturnValue {
  const defaultLabelId = useVaseUiId();
  const isHydrating = useIsHydrating();
  const registeredId = shallowRef<string | undefined>();
  let isMounted = false;

  onMounted(() => {
    isMounted = true;
  });

  const setLabelId: LabelIdSetter = (next) => {
    registeredId.value = typeof next === 'function' ? next(registeredId.value) : next;
  };

  const shownLabels = new Set<ShownLabel>();
  const showCount = shallowRef(0);

  // React runs the effects of a branch that `Activity` shows in tree order, so the last label of
  // the branch wins. `KeepAlive` runs the hooks from the last part to the first part, and a label
  // that mounted later can be before the other labels.
  watch(showCount, () => {
    let lastElement: Element | undefined;
    let lastId: string | undefined;
    for (const label of shownLabels) {
      const element = label.element();
      const id = label.id();
      if (
        element &&
        id !== undefined &&
        (!lastElement ||
          lastElement.compareDocumentPosition(element) & element.DOCUMENT_POSITION_FOLLOWING)
      ) {
        lastElement = element;
        lastId = id;
      }
    }
    shownLabels.clear();
    if (lastId !== undefined) {
      registeredId.value = lastId;
    }
  });

  function getAriaLabelledBy(attrs: Record<string, unknown>) {
    if (registeredId.value !== undefined || !isHydrating.value || hasAriaLabel(attrs)) {
      return registeredId.value;
    }
    return defaultLabelId.value;
  }

  return {
    labelId: computed(() => registeredId.value),
    labelRoot: {
      setLabelId,
      defaultLabelId,
      isMounted: () => isMounted,
      show(label) {
        shownLabels.add(label);
        showCount.value += 1;
      },
    },
    getAriaLabelledBy,
  };
}

// The attributes of the consumer have no blank `aria-label` (VUE-106).
function hasAriaLabel(attrs: Record<string, unknown>) {
  return typeof attrs['aria-label'] === 'string';
}

/**
 * The label calls it. It gives the id of the label to the root.
 * A label of the first render of the root gives the id that it binds, for the server HTML and the
 * hydration. From the mount on, the label gives the `id` that `element` has now (see
 * `useReferencedId`), and no id while that `id` is empty.
 * A label that changes its id replaces only its own id in the root.
 * When `KeepAlive` holds the label, the root does not have the id until the activation.
 * @param idProp The `id` of the consumer. It wins over `defaultLabelId` of the root.
 * @param root The `labelRoot` that `useLabelId` returns.
 * @param element The element of the label.
 * @returns The id that the label binds.
 */
export function useRegisteredLabelId(
  idProp: MaybeRefOrGetter<string | undefined>,
  root: LabelIdRoot,
  element: MaybeRefOrGetter<Element | null | undefined>,
): ComputedRef<string> {
  const { setLabelId } = root;
  const id = computed(() => given('id', toValue(idProp)) ?? root.defaultLabelId.value);
  const { isHeld, shown } = useKeepAliveState();
  const referencedId = useReferencedId(() => id.value, element);

  // The server HTML and the hydration need the id from the first render of the root.
  const writesInSetup = !root.isMounted();
  if (writesInSetup) {
    setLabelId(id.value);
  }

  onMounted(() => {
    const mountedId = referencedId.value;
    if (!writesInSetup && !isHeld.value && mountedId !== undefined) {
      setLabelId(mountedId);
    }
  });

  // The root picks one label for each flush. With the default flush, the pick would run between
  // the watchers of two labels.
  watch(
    shown,
    () => {
      root.show({ id: () => referencedId.value, element: () => toValue(element) });
    },
    { flush: 'sync' },
  );

  watch([referencedId, isHeld], ([nextId, held], [previousId, wasHeld]) => {
    if (held) {
      setLabelId((current) => (current === previousId ? undefined : current));
    } else if (!wasHeld) {
      setLabelId((current) => (current === previousId ? nextId : current));
    }
  });

  onScopeDispose(() => {
    setLabelId((current) => (current === referencedId.value ? undefined : current));
  });

  return id;
}
