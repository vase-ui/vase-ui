import { afterEach, vi } from 'vitest';
import { reset } from '../src/common/error';
import { resetAnimationFrameScheduler } from '../src/common/useAnimationFrame';

// `css.escape`, a dependency of jest-dom, defines the global `CSS`. In Node, that global hides
// the `ReferenceError` that code gets on a server when it uses `CSS` with no check.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

afterEach(() => {
  vi.resetAllMocks();
  // `warn` and `error` share one log-once store, so this also clears the warnings that it holds.
  reset();
  // Drops animation frame callbacks that were scheduled and never ran, for example when fake timers
  // end before the frame fires. The scheduler is global to the process.
  resetAnimationFrameScheduler();
});
