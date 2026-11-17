import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';

/**
 * Sends the click of the element of a part to its hidden input, with the modifier keys of the
 * click. It sends nothing while the input has no parent node.
 *
 * A part compiled as a Vapor component sets the `ref` of the input before it inserts the input. A
 * `ref` callback of the element can click in that time. In Base UI and in a virtual DOM part, the
 * input has no `ref` yet, and the click changes nothing. The parent node marks the insert, also in
 * an app that mounts in an element outside the document, where `isConnected` is `false`. The
 * function does not compare it with the parent of the element, because a `#render` slot can put
 * the element in a wrapper.
 */
export function forwardClickToInput(input: HTMLInputElement | null, event: MouseEvent): void {
  if (!input?.parentNode) {
    return;
  }

  dispatchClickWithModifiers(input, event);
}
