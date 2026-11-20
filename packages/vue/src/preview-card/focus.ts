import type { Ref } from 'vue';
import { ownerDocument } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { useTimeout } from '../common/useTimeout';
import { isInside } from '../popup/layer';
import type { PopupRoot } from '../popup/root';

/**
 * Opens the popup after `delay` when the keyboard moves the focus to the trigger, and closes it
 * when the focus moves out of the layer. A stay of the focus on the trigger opens the popup one
 * time at most, so a popup that Escape closed stays closed when the window gets the focus back.
 */
export function useOpenOnFocus(
  root: () => PopupRoot | null,
  options: { element: Readonly<Ref<HTMLElement | null>>; delay: () => number },
) {
  const openTimer = useTimeout();
  const checkTimer = useTimeout();
  let staying = false;

  function onFocusin(event: FocusEvent) {
    if (staying) return;
    staying = true;
    const element = options.element.value;
    const current = root();
    // A mouse press gives the focus with no `:focus-visible`
    // (test/measurements/preview-card.test.ts).
    if (!element || !current || !element.matches(':focus-visible')) return;
    const open = () => root()?.request(true, 'trigger-focus', event, element);
    if (current.open) open();
    else openTimer.start(options.delay(), open);
  }

  // In the listener, the active element is `<body>`, and a window that loses the focus gives no
  // related target (test/measurements/preview-card.test.ts). So the trigger reads the focused
  // element one task later.
  function onFocusout(event: FocusEvent) {
    openTimer.clear();
    const element = event.currentTarget as Element;
    checkTimer.start(0, () => {
      // Chromium sends `focusout` to a focused link that Vue removes.
      if (!element.isConnected) return;
      const focused = activeElement(ownerDocument(element));
      // The window lost the focus.
      if (focused === element) return;
      staying = false;
      const current = root();
      if (!current || (focused && isInside(current, focused))) return;
      if (current.open && current.activeTrigger === element) {
        current.request(false, 'trigger-focus', event, element);
      }
    });
  }

  return { listeners: { onFocusin, onFocusout } };
}
