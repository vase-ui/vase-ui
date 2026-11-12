import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { reset } from '../src/common/error';
import { resetAnimationFrameScheduler } from '../src/common/useAnimationFrame';

afterEach(() => {
  vi.resetAllMocks();
  // `warn` and `error` share one log-once store, so this also clears the warnings that it holds.
  reset();
  // Drops animation frame callbacks that were scheduled and never ran, for example when fake timers
  // end before the frame fires. The scheduler is global to the process.
  resetAnimationFrameScheduler();
});
