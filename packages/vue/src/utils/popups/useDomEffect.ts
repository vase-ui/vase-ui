import { onMounted, onScopeDispose, watch } from 'vue';
import type { WatchSource } from 'vue';
import { useKeepAliveState } from '../../internals/useKeepAliveState';

/**
 * Runs `run` at mount and after each DOM update that follows a change of `sources`. The cleanup
 * that `run` returns runs before the next run and when the part unmounts.
 *
 * While `KeepAlive` holds the part, the cleanup has run and `run` does not run. `run` runs again
 * at the activation. A part that detects a hold in setup first runs its effect at activation.
 * A change that queues `run` earlier in the flush of the deactivation still
 * runs it. `KeepAlive` has then moved the branch out of the document, except the content of a
 * `Teleport`, and `onDeactivated` has not run yet.
 *
 * A server calls no `onMounted` hook and runs no such `watch`, so `run` reads nothing there.
 *
 * Give effects that must run in order the same `isHeld` ref. Vue prepends each activation or
 * deactivation hook of a descendant to the hooks of the root of a kept branch.
 *
 * Call it in `setup`.
 */
export function useDomEffect(
  sources: WatchSource[],
  run: () => (() => void) | void,
  isHeld = useKeepAliveState().isHeld,
): void {
  // eslint-disable-next-line no-restricted-syntax -- This helper owns the cleanup across the mount, the post flush and the hold hook.
  let cleanup: (() => void) | undefined;
  function update() {
    cleanup?.();
    cleanup = isHeld.value ? undefined : (run() ?? undefined);
  }

  onMounted(update);
  watch(sources, update, { flush: 'post' });
  watch(isHeld, update, { flush: 'sync' });
  onScopeDispose(() => cleanup?.());
}
