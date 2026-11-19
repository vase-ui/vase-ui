import { computed, onMounted, onScopeDispose, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../common/hydration';
import { given } from '../internals/givenAttributes';
import { createIdRegistry } from '../internals/labelable-provider/createIdRegistry';
import type { RegisterId } from '../internals/labelable-provider/createIdRegistry';
import { useReferencedId } from '../internals/labelable-provider/useRegisteredId';
import { useVaseUiId } from '../internals/useVaseUiId';
import { useKeepAliveState } from '../internals/useKeepAliveState';

interface RootLabel {
  id: string;
  element: Element | null | undefined;
}

/** What a label needs from its root. `useLabelId` makes it. */
export interface LabelIdRoot {
  /** Registers the id and the element of a label with the root. */
  registerLabel: RegisterId<RootLabel>;
  defaultLabelId: ComputedRef<string>;
  isMounted: () => boolean;
}

export interface UseLabelIdReturnValue {
  /** The id of the last label in the document that has one. */
  labelId: ComputedRef<string | undefined>;
  labelRoot: LabelIdRoot;
  /**
   * Gives the `aria-labelledby` of the root. The root calls it with the attributes of the consumer,
   * in the function that it gives to `useRenderElement` as `props`.
   */
  getAriaLabelledBy: (attrs: Record<string, unknown>) => string | undefined;
}

/**
 * The root of a part with a label calls it. The root names the last label in the document that has
 * an id. Before a label has an element, it counts in the order of the registrations.
 *
 * A server writes the attributes of the root before the `setup` of a label inside the root. A
 * deferral of the root moves its attributes and that `setup` together, so the label cannot register
 * its id in time. The root makes the id of the label instead. It assumes a label until it is
 * mounted, unless the consumer gives the root a non-blank `aria-label`. A non-blank
 * `aria-labelledby` of the consumer wins, because the attributes of the consumer merge last.
 *
 * The first render in a browser makes the same assumption so its `aria-labelledby` matches the
 * server HTML.
 */
export function useLabelId(): UseLabelIdReturnValue {
  const defaultLabelId = useVaseUiId();
  const isHydrating = useIsHydrating();
  const { ids: labels, registerId: registerLabel } = createIdRegistry<RootLabel>();
  let isMounted = false;

  onMounted(() => {
    isMounted = true;
  });

  const labelId = computed(() => {
    let last: RootLabel | undefined;
    for (const label of labels.value) {
      if (
        !last?.element ||
        !label.element ||
        last.element.compareDocumentPosition(label.element) &
          label.element.DOCUMENT_POSITION_FOLLOWING
      ) {
        last = label;
      }
    }
    return last?.id;
  });

  function getAriaLabelledBy(attrs: Record<string, unknown>) {
    if (labelId.value !== undefined || !isHydrating.value || hasAriaLabel(attrs)) {
      return labelId.value;
    }
    return defaultLabelId.value;
  }

  return {
    labelId,
    labelRoot: {
      registerLabel,
      defaultLabelId,
      isMounted: () => isMounted,
    },
    getAriaLabelledBy,
  };
}

// The attributes of the consumer have no blank `aria-label` (VUE-106).
function hasAriaLabel(attrs: Record<string, unknown>) {
  return typeof attrs['aria-label'] === 'string';
}

/**
 * The label calls it in `setup`. It registers the label with the root.
 *
 * While the root is not mounted, the label registers in `setup`, for the server HTML and the
 * hydration. After the root is mounted, the label registers in `onMounted`. Before that hook, the
 * label has no element, so the root cannot read its place in the document.
 *
 * From the mount on, the label gives the `id` that `element` has now (see `useReferencedId`). It
 * gives no id while `KeepAlive` holds it or while that `id` is empty.
 *
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
  const id = computed(() => given('id', toValue(idProp)) ?? root.defaultLabelId.value);
  const { isHeld } = useKeepAliveState();
  const referencedId = useReferencedId(() => id.value, element);
  const source = Symbol();

  const register = () => {
    root.registerLabel(source, () => {
      const referenced = isHeld.value ? undefined : referencedId.value;
      return referenced === undefined ? undefined : { id: referenced, element: toValue(element) };
    });
  };

  if (root.isMounted()) {
    onMounted(register);
  } else {
    register();
  }

  onScopeDispose(() => {
    root.registerLabel(source, undefined);
  });

  return id;
}
