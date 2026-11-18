import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';

/**
 * Sends the click of the element of a part to its hidden input, with the modifier keys of the
 * click. It sends nothing while the input has no parent node.
 *
 * A Vapor part can receive a click after it sets the input ref and before it inserts the input.
 * The parent node marks insertion even when the app mounts outside the document.
 */
export function forwardClickToInput(input: HTMLInputElement | null, event: MouseEvent): void {
  if (!input?.parentNode) {
    return;
  }

  dispatchClickWithModifiers(input, event);
}
