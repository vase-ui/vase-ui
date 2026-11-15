import { computed, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { visuallyHiddenInput } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * Keeps the dismiss button of a combobox while `enabled` is `true`, and writes it to `buttonRef`.
 * The button is a visually hidden `span` with `role="button"` and the name `Dismiss`. It is not
 * tabbable. A screen reader presses it to close the popup.
 *
 * The part keeps the button beside its element, so the part has one root node. The composable makes
 * the button for the document of `element`, so the server HTML has no button. It clears `buttonRef`
 * only while the ref holds its own button. Another part can write its button to the ref while this
 * part stays mounted.
 */
export function useDismissButton(
  element: Readonly<Ref<HTMLElement | null>>,
  enabled: MaybeRefOrGetter<boolean>,
  buttonRef: ShallowRef<HTMLSpanElement | null>,
): ComputedRef<HTMLSpanElement | null> {
  const store = useComboboxRootContext();
  let button: HTMLSpanElement | null = null;

  function handleClick(event: MouseEvent) {
    store.setOpen(
      false,
      createChangeEventDetails(REASONS.closePress, event, event.currentTarget as HTMLElement),
    );
  }

  const shownButton = computed(() => {
    const target = element.value;
    if (!target || !toValue(enabled)) {
      return null;
    }
    if (button?.ownerDocument !== target.ownerDocument) {
      button = target.ownerDocument.createElement('span');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Dismiss');
      Object.assign(button.style, visuallyHiddenInput);
      button.addEventListener('click', handleClick);
    }
    return button;
  });

  watch(
    shownButton,
    (next, previous) => {
      if (next) {
        buttonRef.value = next;
      } else if (buttonRef.value === previous) {
        buttonRef.value = null;
      }
    },
    { flush: 'post' },
  );

  onScopeDispose(() => {
    if (button && buttonRef.value === button) {
      buttonRef.value = null;
    }
  });

  return shownButton;
}
