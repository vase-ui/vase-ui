import { computed, onMounted, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { observeRootNode } from '../../internals/observeRootNode';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useFieldsetRootContext } from './FieldsetRootContext';

const FIELDSET_ATTRIBUTES = ['disabled'] as const;

/**
 * Whether HTML disables a form control at the place of `element`. A `<fieldset disabled>` disables
 * each control in it, except a control in its first `<legend>` child.
 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#concept-fe-disabled
 */
function isInDisabledFieldset(element: Element): boolean {
  for (
    let fieldset = element.parentElement?.closest('fieldset');
    fieldset;
    fieldset = fieldset.parentElement?.closest('fieldset')
  ) {
    if (fieldset.disabled && !fieldset.querySelector(':scope > legend')?.contains(element)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a fieldset disables the part of `element`: `Fieldset.Root` with `disabled`, or a native
 * `<fieldset disabled>` as HTML says. Call it in `setup`. The part knows a native fieldset only
 * after its mount, so the server HTML follows `Fieldset.Root` only. While `element` gives `null`,
 * no native fieldset disables the part. The state follows the element to another root node.
 */
export function useFieldsetDisabled(
  element: MaybeRefOrGetter<Element | null | undefined>,
): ComputedRef<boolean> {
  const fieldset = useFieldsetRootContext(true);
  const isNativeFieldsetDisabled = shallowRef(false);
  // `KeepAlive` moves the DOM of a held part into a detached element, out of each fieldset above
  // the branch. The part keeps its state until the activation.
  const { isHeld } = useKeepAliveState();

  // A part declares its element after it calls this composable, and a `watch` reads its sources at
  // once. The `watch` thus starts at the mount.
  // A `Fieldset.Root` above writes its `disabled` attribute in the flush that changes its context.
  // The context is a source, so the read runs again in that flush, after the DOM update. Nested
  // roots thus follow in one flush. The observer alone calls back only after the flush, one level
  // of nesting at a time.
  onMounted(() => {
    watch(
      [() => toValue(element), isHeld, () => fieldset?.disabled.value],
      ([partElement, held], _previous, onCleanup) => {
        if (held) {
          return;
        }
        // The root of a date picker reads the element of its field or of its trigger, and each of
        // them can unmount while the root stays.
        if (!partElement) {
          isNativeFieldsetDisabled.value = false;
          return;
        }

        const update = () => {
          isNativeFieldsetDisabled.value = isInDisabledFieldset(partElement);
        };

        update();
        onCleanup(observeRootNode(partElement, update, FIELDSET_ATTRIBUTES));
      },
      { flush: 'post', immediate: true },
    );
  });

  return computed(() => (fieldset?.disabled.value ?? false) || isNativeFieldsetDisabled.value);
}
