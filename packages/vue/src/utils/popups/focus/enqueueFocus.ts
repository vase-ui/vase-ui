import { NOOP } from '../../../common/empty';
import { AnimationFrame } from '../../../common/useAnimationFrame';
import type { FocusableElement } from './tabbable';

interface Options {
  preventScroll?: boolean | undefined;
  sync?: boolean | undefined;
  // Called when the frame runs to decide whether focus should still be applied.
  shouldFocus?: (() => boolean) | undefined;
}

// `AnimationFrame` gives ids from 1, so `0` is no frame.
let frameId = 0;
export function enqueueFocus(el: FocusableElement | null, options: Options = {}) {
  const { preventScroll = false, sync = false, shouldFocus } = options;

  AnimationFrame.cancel(frameId);

  function exec() {
    if (shouldFocus && !shouldFocus()) {
      return;
    }
    el?.focus({ preventScroll });
  }

  if (sync) {
    exec();
    return NOOP;
  }

  const currentFrameId = AnimationFrame.request(exec);
  frameId = currentFrameId;
  return () => {
    if (frameId === currentFrameId) {
      AnimationFrame.cancel(currentFrameId);
      frameId = 0;
    }
  };
}
