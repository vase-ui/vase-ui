import { onScopeDispose } from 'vue';

type AnimationFrameId = number;

// `requestAnimationFrame` does not promise a positive integer id, so `0` cannot mean empty.
// The empty value is `null`.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame#return_value
const EMPTY = null;

let LAST_RAF = globalThis.requestAnimationFrame;

class Scheduler {
  // An array holds the frame callbacks. A cancel sets its entry to `null`, which takes O(1) time.
  // The scheduler never calls the native `cancelAnimationFrame`, even when no callback is left.
  // This is efficient for the pattern request, cancel, request, cancel.
  // In the pattern request, request, cancel, cancel, the last frame still runs.
  // `callbacksCount` makes that frame a no-op that takes O(1) time.

  callbacks = [] as (FrameRequestCallback | null)[];

  callbacksCount = 0;

  nextId = 1;

  startId = 1;

  isScheduled = false;

  tick = (timestamp: number) => {
    this.isScheduled = false;

    const currentCallbacks = this.callbacks;
    const currentCallbacksCount = this.callbacksCount;

    // Update these before the loop, because a callback can call `requestAnimationFrame` again.
    this.callbacks = [];
    this.callbacksCount = 0;
    this.startId = this.nextId;

    if (currentCallbacksCount > 0) {
      for (let i = 0; i < currentCallbacks.length; i += 1) {
        currentCallbacks[i]?.(timestamp);
      }
    }
  };

  request(fn: FrameRequestCallback) {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.push(fn);
    this.callbacksCount += 1;

    // Fake timers in a test can stop before a fake `requestAnimationFrame` runs its frame.
    // `isScheduled` then stays set and `tick` never runs.
    // `didRAFChange` finds a new `requestAnimationFrame` function and schedules the tick again.
    const didRAFChange =
      process.env.NODE_ENV !== 'production' &&
      LAST_RAF !== requestAnimationFrame &&
      ((LAST_RAF = requestAnimationFrame), true);

    if (!this.isScheduled || didRAFChange) {
      requestAnimationFrame(this.tick);
      this.isScheduled = true;
    }
    return id;
  }

  cancel(id: AnimationFrameId) {
    const index = id - this.startId;
    if (index < 0 || index >= this.callbacks.length) {
      return;
    }
    if (this.callbacks[index] === null) {
      return;
    }
    this.callbacks[index] = null;
    this.callbacksCount -= 1;
  }
}

let scheduler = new Scheduler();

// For tests only. The scheduler is global to the process.
// A callback that never runs would run in a later test.
// This happens when fake timers stop before the frame fires.
// Call this function between tests to drop such callbacks.
export function resetAnimationFrameScheduler() {
  const previous = scheduler;
  scheduler = new Scheduler();
  // The id sequence continues, so a `cancel` call from an `AnimationFrame` made before the reset
  // cannot cancel a callback made after it.
  scheduler.nextId = previous.nextId;
  scheduler.startId = previous.nextId;
  // A frame requested before the reset can still be pending, and it holds the previous `tick`.
  // Empty the previous queue in place, so that this frame runs nothing.
  previous.callbacks = [];
  previous.callbacksCount = 0;
}

export class AnimationFrame {
  static create() {
    return new AnimationFrame();
  }

  static request(fn: FrameRequestCallback) {
    return scheduler.request(fn);
  }

  static cancel(id: AnimationFrameId) {
    return scheduler.cancel(id);
  }

  currentId: AnimationFrameId | null = EMPTY;

  request(fn: () => void) {
    this.cancel();
    this.currentId = scheduler.request(() => {
      this.currentId = EMPTY;
      fn();
    });
  }

  cancel = () => {
    if (this.currentId !== EMPTY) {
      scheduler.cancel(this.currentId);
      this.currentId = EMPTY;
    }
  };
}

export function useAnimationFrame() {
  const frame = AnimationFrame.create();
  onScopeDispose(frame.cancel);
  return frame;
}
