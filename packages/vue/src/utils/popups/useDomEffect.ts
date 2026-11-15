import { onActivated, onDeactivated, onMounted, onScopeDispose, watch } from 'vue';
import type { WatchSource } from 'vue';
import { isInHeldBranch } from '../../internals/useKeepAliveState';

/**
 * Runs `run` at mount and after each DOM update that follows a change of `sources`. The cleanup
 * that `run` returns runs before the next run and when the part unmounts.
 *
 * While `KeepAlive` holds the part, the cleanup has run and `run` does not run. `run` runs again
 * at the activation. A part that mounts in a branch that `KeepAlive` holds thus runs `run` first at
 * the activation. A change that queues `run` earlier in the flush of the deactivation still
 * runs it. `KeepAlive` has then moved the branch out of the document, except the content of a
 * `Teleport`, and `onDeactivated` has not run yet.
 *
 * A server calls no `onMounted` hook and runs no such `watch`, so `run` reads nothing there.
 *
 * Call it in `setup`.
 */
export function useDomEffect(sources: WatchSource[], run: () => (() => void) | void): void {
  let cleanup: (() => void) | undefined;
  let deactivated = isInHeldBranch();

  function update() {
    cleanup?.();
    cleanup = deactivated ? undefined : (run() ?? undefined);
  }

  onMounted(update);
  watch(sources, update, { flush: 'post' });
  onDeactivated(() => {
    deactivated = true;
    update();
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      update();
    }
  });
  onScopeDispose(() => cleanup?.());
}
