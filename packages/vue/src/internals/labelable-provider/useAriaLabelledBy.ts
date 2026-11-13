import { computed, onActivated, onDeactivated, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { ownerWindow } from '../../common/owner';
import { useVaseUiId } from '../useBaseUiId';

/**
 * A control calls it in `setup` when its element is not a labelable element of HTML, such as a
 * `<span>` with a role. The control binds the result to `aria-labelledby`.
 *
 * The result is the first of these that exists: `explicitAriaLabelledBy`, `labelId`, and the `id`
 * of the native `<label>` that names `labelSourceRef`. A server has no DOM, so the server HTML
 * never has the id of a native `<label>`. The control gets it in the first flush after the mount.
 * The result follows a label that comes or goes, a change of its `for` and a change of its `id`. It
 * also follows a change of the `id` of the control.
 * @param labelId The id of the label of the provider. Pass the result of `useControlLabelId()`.
 * @param labelSourceRef The labelable element, such as the hidden input of the control. Pass a ref
 * that a ref callback writes, or a getter of one. The lookup starts when the value changes from
 * `null` to the element, so the composable needs no `onMounted`.
 * @param labelSourceId The `id` of the labelable element. A native `<label>` that has no `id` gets
 * this id plus `-label`. With no id, it gets a generated id.
 */
export function useAriaLabelledBy(
  explicitAriaLabelledBy: MaybeRefOrGetter<string | undefined>,
  labelId: MaybeRefOrGetter<string | undefined>,
  labelSourceRef: MaybeRefOrGetter<LabelSource | null>,
  enableFallback: MaybeRefOrGetter<boolean> = true,
  labelSourceId?: MaybeRefOrGetter<string | undefined>,
  ariaLabel?: MaybeRefOrGetter<string | undefined>,
): ComputedRef<string | undefined> {
  const fallbackAriaLabelledBy = shallowRef<string | undefined>();

  const generatedLabelId = useVaseUiId(() => {
    const sourceId = toValue(labelSourceId);
    return sourceId ? `${sourceId}-label` : undefined;
  });

  // A non-blank `aria-label` wins over any associated label, as it does on native inputs.
  const hasAriaLabel = () => Boolean(toValue(ariaLabel)?.trim());

  const ariaLabelledBy = computed(() => {
    const implicitLabelId = hasAriaLabel() ? undefined : toValue(labelId);
    return toValue(explicitAriaLabelledBy) ?? implicitLabelId ?? fallbackAriaLabelledBy.value;
  });

  const isLookupEnabled = () =>
    !(
      toValue(explicitAriaLabelledBy) ||
      toValue(labelId) ||
      hasAriaLabel() ||
      !toValue(enableFallback)
    );

  // `KeepAlive` moves the DOM of a deactivated control into a detached element. The input has no
  // label there, and its root node is that element. The lookup and the observer wait for the
  // activation.
  const isDeactivated = shallowRef(false);

  onDeactivated(() => {
    isDeactivated.value = true;
  });

  onActivated(() => {
    isDeactivated.value = false;
  });

  // Base UI runs this lookup after each commit. A Vue component with the same props does not render
  // again when its parent renders, so a native `<label>` that a sibling adds or removes later would
  // not change the result. The lookup thus also runs when the DOM of the root node changes.
  watch(
    [() => toValue(labelSourceRef), isLookupEnabled, generatedLabelId, isDeactivated],
    ([labelSource, enabled, , deactivated], _previous, onCleanup) => {
      if (!labelSource || !enabled || deactivated) {
        fallbackAriaLabelledBy.value = undefined;
        return;
      }

      const update = () => {
        fallbackAriaLabelledBy.value = getAriaLabelledBy(labelSource, generatedLabelId.value);
      };

      update();
      onCleanup(observeLabels(labelSource.getRootNode(), update));
    },
    { flush: 'post' },
  );

  return ariaLabelledBy;
}

interface LabelObserver {
  observer: MutationObserver;
  callbacks: Set<() => void>;
}

// The map is in the module, so each copy of the library has its own observers.
const labelObservers = new WeakMap<Node, LabelObserver>();

/**
 * Calls `callback` after a change in the tree of `root` that can change a label. It returns the
 * function that removes the callback.
 *
 * All callbacks of one root node share one observer, because a form has many controls and each
 * observer of a root gets each record. The caller gives the root node of the control, and not the
 * document: an observer of a document does not see a shadow tree.
 */
function observeLabels(root: Node, callback: () => void): () => void {
  let labelObserver = labelObservers.get(root);

  if (!labelObserver) {
    const callbacks = new Set<() => void>();
    // The callbacks ignore the records. A lookup is cheap, and it writes only a different id.
    const observer = new MutationObserver(() => {
      callbacks.forEach((run) => run());
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['for', 'id'],
    });
    labelObserver = { observer, callbacks };
    labelObservers.set(root, labelObserver);
  }

  const { observer, callbacks } = labelObserver;
  callbacks.add(callback);

  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      observer.disconnect();
      labelObservers.delete(root);
    }
  };
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  // The parent and the next sibling are the usual label. They cost less than the search below.
  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  // `labels` is not in use: WebKit keeps that list as it was before a change of the `id` of the
  // control. The `control` of a label is correct after that change.
  let label: HTMLLabelElement | undefined;

  if (controlId) {
    const root = labelSource.getRootNode() as Document | ShadowRoot | Element;
    const labelWithFor = root.querySelector<HTMLLabelElement>(
      `label[for="${ownerWindow(labelSource).CSS.escape(controlId)}"]`,
    );
    if (labelWithFor?.control === labelSource) {
      label = labelWithFor;
    }
  }

  // The result is the first label in tree order, as `labels[0]` is.
  for (let node = parent; node; node = node.parentElement) {
    if (
      node.tagName === 'LABEL' &&
      (node as HTMLLabelElement).control === labelSource &&
      (!label || node.compareDocumentPosition(label) & node.DOCUMENT_POSITION_FOLLOWING)
    ) {
      label = node as HTMLLabelElement;
    }
  }

  return label;
}

type LabelSource = HTMLElement;
