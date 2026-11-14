import { onActivated, onDeactivated } from 'vue';

/**
 * Makes the `ref` callback of a part whose element a trigger names in `aria-controls`. Call it in
 * `setup`.
 *
 * The callback gives the element to `setElement`. `KeepAlive` takes the element out of the
 * document and calls no `ref` callback. `setElement` thus gets `null` while `KeepAlive` holds the
 * part, and the element again when `KeepAlive` shows the part. No trigger then names an element
 * that is out of the document.
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

  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (isDeactivated) {
      isDeactivated = false;
      setElement(element);
    }
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
