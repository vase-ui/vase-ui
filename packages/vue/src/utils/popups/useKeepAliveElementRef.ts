import { onActivated, onDeactivated } from 'vue';

/**
 * Makes the `ref` callback of a part whose element a trigger names in `aria-controls`. Call it in
 * `setup`.
 *
 * The callback gives the element to `setElement`. `KeepAlive` takes the element out of the
 * document and calls no `ref` callback. `setElement` thus gets `null` when `KeepAlive` deactivates
 * the part, and the element again when it activates the part. The trigger then names no element
 * that `KeepAlive` took out of the document.
 *
 * A part that mounts in a branch that `KeepAlive` holds gets no `onDeactivated` call, so it gives
 * its element at once. Do not check `isConnected` in place of the hooks: a part in a pending
 * `Suspense` branch is also out of the document, and it gets no `onActivated` call.
 * @param setElement The setter of the part. It writes the element to the store or to the context.
 */
export function useKeepAliveElementRef(
  setElement: (element: HTMLElement | null) => void,
): (element: HTMLElement | null) => void {
  let element: HTMLElement | null = null;
  let isDeactivated = false;

  onDeactivated(() => {
    isDeactivated = true;
    setElement(null);
  });

  onActivated(() => {
    isDeactivated = false;
    setElement(element);
  });

  return (value) => {
    element = value;
    // A render while `KeepAlive` holds the part can give a new element. It is out of the document
    // too.
    if (!isDeactivated) {
      setElement(value);
    }
  };
}
