import { shallowRef, watch } from 'vue';
import { useKeepAliveState } from '../../internals/useKeepAliveState';

/**
 * Makes the `ref` callback of a part whose element a trigger names in `aria-controls`. Call it in
 * `setup`.
 *
 * `KeepAlive` takes the element out of the document and calls no `ref` callback. `setElement` thus
 * gets `null` when `isHeld` of `useKeepAliveState` becomes `true`, and the element when it becomes
 * `false`. A part that mounts in a held branch gives no element until the activation. The trigger
 * then names no element that `KeepAlive` took out of the document.
 * @param setElement The setter of the part. It writes the element to the store or to the context.
 */
export function useKeepAliveElementRef(
  setElement: (element: HTMLElement | null) => void,
): (element: HTMLElement | null) => void {
  const element = shallowRef<HTMLElement | null>(null);
  const { isHeld } = useKeepAliveState();
  // Vue calls the `ref` callback during a render. A read of `isHeld` there would make that render
  // depend on it.
  let held = isHeld.value;

  watch(
    isHeld,
    (value) => {
      held = value;
      setElement(value ? null : element.value);
    },
    { flush: 'sync' },
  );

  return (value) => {
    element.value = value;
    // A render while `KeepAlive` holds the part can give a new element. It is out of the document
    // too.
    if (!held) {
      setElement(value);
    }
  };
}
