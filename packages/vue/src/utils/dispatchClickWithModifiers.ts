import { ownerWindow } from '../common/owner';

interface ModifierState {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Dispatches a click on the target with the modifier keys of the source event.
 * `click()` always reports the modifier keys as not pressed, so the code makes the event itself.
 * A click that a script dispatches still runs the activation behavior of the element, such as a
 * form submit or a link.
 * `detail` 0 and `pointerType` `''` are what a browser gives a click that comes from the keyboard.
 * A caller that stands for a mouse gesture passes `detail: 1` and `pointerType: 'mouse'`.
 */
export function dispatchClickWithModifiers(
  target: Element,
  sourceEvent: ModifierState,
  {
    detail = 0,
    pointerType = '',
  }: { detail?: number | undefined; pointerType?: string | undefined } = {},
) {
  target.dispatchEvent(
    new (ownerWindow(target).PointerEvent)('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
      pointerType,
      shiftKey: sourceEvent.shiftKey,
      ctrlKey: sourceEvent.ctrlKey,
      altKey: sourceEvent.altKey,
      metaKey: sourceEvent.metaKey,
    }),
  );
}
