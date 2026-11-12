/**
 * Creates a queue that runs callbacks in a microtask, so that the browser does not paint an
 * intermediate frame: https://github.com/mui/base-ui/issues/979
 * Callbacks that become ready within the same microtask checkpoint run together, so Vue applies
 * their state writes in one flush: https://github.com/mui/base-ui/issues/5481
 * A callback runs before the flush of the state writes of the earlier callbacks of its group, so
 * callers that read DOM or state that another caller can change need their own queue.
 */
export function createFlushBeforePaint() {
  let pendingCallbacks: Array<() => void> | null = null;

  return function flushBeforePaint(fn: () => void) {
    if (!pendingCallbacks) {
      const callbacks: Array<() => void> = [];
      pendingCallbacks = callbacks;
      queueMicrotask(() => {
        pendingCallbacks = null;
        for (const callback of callbacks) {
          callback();
        }
      });
    }
    pendingCallbacks.push(fn);
  };
}
