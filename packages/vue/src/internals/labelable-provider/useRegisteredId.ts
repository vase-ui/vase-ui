import { onActivated, onDeactivated, onScopeDispose, watch } from 'vue';

/**
 * Keeps the id of a part registered while the part is active.
 * `register` gets the id, or `undefined` to remove it.
 *
 * The call in `setup` puts the id in the server HTML of each part that renders after this part.
 * Do not replace it with a `watch` that has `immediate` and `onCleanup`. A server render stops that
 * watcher after its first run, and the stop runs the cleanup.
 */
export function useRegisteredId(
  getId: () => string | undefined,
  register: (id: string | undefined) => void,
): void {
  // `KeepAlive` removes the DOM of a deactivated part from the document, so the provider must not
  // keep the id of that part.
  let isDeactivated = false;
  const sync = () => register(isDeactivated ? undefined : getId());

  sync();
  watch(getId, sync);

  onDeactivated(() => {
    isDeactivated = true;
    sync();
  });

  onActivated(() => {
    // `onActivated` also runs at the first mount inside `KeepAlive`, where `setup` registered the id.
    if (!isDeactivated) {
      return;
    }

    isDeactivated = false;
    sync();
  });

  onScopeDispose(() => register(undefined));
}
