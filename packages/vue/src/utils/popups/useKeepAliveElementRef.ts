import { shallowRef, watch } from 'vue';
import { isInTreeOf, useKeepAliveState } from '../../internals/useKeepAliveState';

/**
 * Makes the `ref` callback of a part whose element a trigger names in `aria-controls`. Call it in
 * `setup`.
 *
 * `KeepAlive` takes the element out of the document and calls no `ref` callback. `setElement` thus
 * gets the element only while `KeepAlive` does not hold the part. It gets `null` when `KeepAlive`
 * holds the part, and the element again at the activation. The trigger then names no element that
 * `KeepAlive` took out of the document.
 * @param setElement The setter of the part. It writes the element to the store or to the context.
 * @param trigger The element of the trigger that names the part. `useKeepAliveState` holds a part
 * that mounts in a held branch when its element is not in a document and not in the tree of the
 * trigger.
 */
export function useKeepAliveElementRef(
  setElement: (element: HTMLElement | null) => void,
  trigger: () => Element | null | undefined,
): (element: HTMLElement | null) => void {
  const element = shallowRef<HTMLElement | null>(null);
  const { isHeld } = useKeepAliveState(element, (target) => isInTreeOf(trigger(), target));
  // Vue calls the `ref` callback during a render. A read of `isHeld` there would make that render
  // depend on it.
  let held = false;

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
