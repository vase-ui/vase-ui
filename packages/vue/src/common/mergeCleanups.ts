type Cleanup = false | null | undefined | (() => void);

export function mergeCleanups(...cleanups: Cleanup[]) {
  return () => {
    for (const cleanup of cleanups) {
      if (cleanup) {
        cleanup();
      }
    }
  };
}
