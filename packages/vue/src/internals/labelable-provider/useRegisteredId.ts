import { onActivated, onDeactivated, onScopeDispose, shallowRef } from 'vue';

/**
 * Registers the id of a part for as long as the part exists.
 * `register` gets a getter for the id, or `undefined` to remove the registration. The getter
 * returns `undefined` while `KeepAlive` has the part deactivated, because `KeepAlive` removes the
 * DOM of that part from the document.
 *
 * The call in `setup` puts the id in the server HTML of each part that renders after this part.
 * It also gives the part its place in the order of the registrations, and the part keeps that place
 * in a deactivation. `KeepAlive` runs the `onActivated` hooks of one branch from its last part to
 * its first part, so a registration in `onActivated` would reverse the order of the parts.
 *
 * Do not replace the call with a `watch` that has `immediate` and `onCleanup`. A server render
 * stops that watcher after its first run, and the stop runs the cleanup.
 */
export function useRegisteredId(
  getId: () => string | undefined,
  register: (getId: (() => string | undefined) | undefined) => void,
): void {
  const isDeactivated = shallowRef(false);

  onDeactivated(() => {
    isDeactivated.value = true;
  });

  onActivated(() => {
    isDeactivated.value = false;
  });

  register(() => (isDeactivated.value ? undefined : getId()));

  onScopeDispose(() => register(undefined));
}
