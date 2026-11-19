import { computed, onMounted, onScopeDispose, shallowRef, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useElementId } from '../../utils/popups/useElementId';
import { useKeepAliveState } from '../useKeepAliveState';
import type { RegisterId } from './createIdRegistry';

/**
 * Registers the id that a reference to a part names. Call it in `setup`.
 *
 * `register` is the function of a registry, such as `registerId` of `createIdRegistry()`. It gets a
 * source symbol of the part, and a getter for the id or `undefined` when the part goes away. The
 * getter gives the result of `useReferencedId`, and `undefined` while `KeepAlive` holds the part.
 * `KeepAlive` removes the DOM of that part from the document.
 *
 * A call in `setup` puts the id in the server HTML of each part that renders after this part. It
 * also gives the part its place in the order of the registrations. The part keeps that place while
 * `KeepAlive` holds it. `KeepAlive` runs the `onActivated` hooks of one branch from its last part to
 * its first part, so a registration in `onActivated` would reverse the order of the parts.
 *
 * Do not replace the call with a `watch` that has `immediate` and `onCleanup`. A server render
 * stops that watcher after its first run, and the stop runs the cleanup.
 */
export function useRegisteredId(
  getId: () => string | undefined,
  register: RegisterId,
  element: MaybeRefOrGetter<Element | null | undefined>,
): void {
  const { isHeld } = useKeepAliveState();
  const referencedId = useReferencedId(getId, element);
  const source = Symbol();

  register(source, () => (isHeld.value ? undefined : referencedId.value));

  onScopeDispose(() => register(source, undefined));
}

/**
 * Gives the id that a reference to a part names. Call it in `setup`.
 *
 * `getId` gives the id that the part binds to its element, or `undefined` when the part has no id.
 * Before the mount, the result is that id. A server has no element, so the server HTML and the
 * hydration render name the id that the part binds.
 *
 * From the mount on, the result is the `id` that `element` has now, and it follows each change. A
 * `#render` slot can give the element another `id` than the part binds. The result is `undefined`
 * while `element` gives no element, while the element has an empty `id`, and while `getId` gives
 * `undefined`.
 *
 * The composable reads `element` only from the mount on. A part can thus give a getter of an
 * element that its `setup` declares later.
 *
 * The result is a `computed`. At the mount, a part that reads it renders again only when the
 * element has another `id` than the part binds.
 */
export function useReferencedId(
  getId: () => string | undefined,
  element: MaybeRefOrGetter<Element | null | undefined>,
): ComputedRef<string | undefined> {
  const isMounted = shallowRef(false);
  onMounted(() => {
    isMounted.value = true;
  });
  const elementId = useElementId(
    computed(() => (isMounted.value ? (toValue(element) ?? null) : null)),
  );

  return computed(() => {
    const id = getId();
    if (id === undefined || !isMounted.value) {
      return id;
    }
    return elementId.value || undefined;
  });
}
