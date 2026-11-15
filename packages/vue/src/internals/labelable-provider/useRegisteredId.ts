import { onScopeDispose } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from '../useKeepAliveState';

/**
 * Registers the id of a part for as long as the part exists.
 * `register` gets a getter for the id, or `undefined` to remove the registration. The getter
 * returns `undefined` while `KeepAlive` holds the part, because `KeepAlive` removes the DOM of that
 * part from the document.
 *
 * The call in `setup` puts the id in the server HTML of each part that renders after this part.
 * It also gives the part its place in the order of the registrations, and the part keeps that place
 * while `KeepAlive` holds it. `KeepAlive` runs the `onActivated` hooks of one branch from its last
 * part to its first part. A registration in `onActivated` would then reverse the order of the parts.
 *
 * Do not replace the call with a `watch` that has `immediate` and `onCleanup`. A server render
 * stops that watcher after its first run, and the stop runs the cleanup.
 * @param element The element of the part.
 * @param reaches Whether an id reference of the owner of the registry reaches an element. With
 * `element`, the getter gives no id for a part that mounts in a held branch.
 */
export function useRegisteredId(
  getId: () => string | undefined,
  register: (getId: (() => string | undefined) | undefined) => void,
  element?: MaybeRefOrGetter<Element | null | undefined>,
  reaches?: (element: Element) => boolean,
): void {
  const { isHeld } = useKeepAliveState(element, reaches);

  register(() => (isHeld.value ? undefined : getId()));

  onScopeDispose(() => register(undefined));
}
