import type { Ref } from 'vue';
import { ownerDocument } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { useTimeout } from '../common/useTimeout';
import { isInPopup, layerOf } from '../popup/layer';
import type { PopupRoot } from '../popup/root';

/**
 * Opens the popup when its trigger gets the focus of a key, and closes it when the focus leaves
 * the trigger. A press gives a button and a link no `:focus-visible`
 * (test/measurements/tooltip.test.ts).
 */
export function useOpenOnFocus(
  root: () => PopupRoot | null,
  options: {
    element: Readonly<Ref<HTMLElement | null>>;
    /** The trigger opens nothing. */
    disabled: () => boolean;
    /** The focus event comes from a trigger in this trigger. */
    inner: (event: FocusEvent) => boolean;
    /**
     * The focus of the trigger opens nothing, until the focus leaves the trigger. The trigger also
     * sets it after a press. A text field matches `:focus-visible` at each focus.
     */
    blocked: { value: boolean };
  },
) {
  const later = useTimeout();

  function onFocusin(event: FocusEvent) {
    const current = root();
    const element = options.element.value;
    if (!current || !element || options.disabled() || options.blocked.value) return;
    if (options.inner(event) || !(event.target as Element).matches(':focus-visible')) return;
    current.request(true, 'trigger-focus', event, element);
  }

  // The focus stays in the tooltip: in its popup, or on another trigger of the root.
  function staysInside(current: PopupRoot, target: Element) {
    const layer = layerOf(current);
    return (
      options.element.value?.contains(target) ||
      (!!layer && isInPopup(layer, target)) ||
      current.triggers.some((trigger) => !trigger.disabled && trigger.element?.contains(target))
    );
  }

  function close(event: FocusEvent) {
    const current = root();
    if (current?.open && current.activeTrigger === options.element.value) {
      current.request(false, 'trigger-focus', event);
    }
  }

  function onFocusout(event: FocusEvent) {
    const current = root();
    const element = options.element.value;
    if (!current || !element) return;
    const related = event.relatedTarget as Element | null;
    if (related) {
      if (!staysInside(current, related)) {
        options.blocked.value = false;
        close(event);
      }
      return;
    }
    // The window that loses the focus keeps the trigger as its active element. A press on an
    // element with no tab stop moves the focus to `<body>` (test/measurements/tooltip.test.ts).
    const doc = ownerDocument(element);
    later.start(0, () => {
      if (activeElement(doc) === element) {
        if (!current.open) options.blocked.value = true;
        return;
      }
      options.blocked.value = false;
      close(event);
    });
  }

  return { onFocusin, onFocusout };
}
