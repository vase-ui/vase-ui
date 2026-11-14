import { onActivated, onDeactivated, onMounted, onScopeDispose, watch } from 'vue';
import type { WatchSource } from 'vue';

/**
 * Runs `run` at mount and after each DOM update that follows a change of `sources`. The cleanup
 * that `run` returns runs before the next run and when the part unmounts.
 *
 * While `KeepAlive` holds the part, the cleanup has run and `run` does not run. `run` runs again
 * at the activation.
 *
 * A server calls no `onMounted` hook and runs no such `watch`, so `run` reads nothing there.
 *
 * Call it in `setup`.
 */
export function useDomEffect(sources: WatchSource[], run: () => (() => void) | void): void {
  let cleanup: (() => void) | undefined;
  let deactivated = false;

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
