import { onScopeDispose } from 'vue';

type TimeoutId = number;

const EMPTY = 0 as TimeoutId;

export class Timeout {
  static create() {
    return new Timeout();
  }

  currentId: TimeoutId = EMPTY;

  start(delay: number, fn: () => void) {
    this.clear();
    // The Node.js types are in the project, so `setTimeout` has the Node.js return type.
    this.currentId = setTimeout(() => {
      this.currentId = EMPTY;
      fn();
    }, delay) as unknown as number;
  }

  isStarted() {
    return this.currentId !== EMPTY;
  }

  clear = () => {
    if (this.currentId !== EMPTY) {
      clearTimeout(this.currentId);
      this.currentId = EMPTY;
    }
  };
}

// Call this in `setup` or in an effect scope.
// Code with no scope uses `Timeout.create()` and calls `clear` itself.
export function useTimeout() {
  const timeout = Timeout.create();
  onScopeDispose(timeout.clear);
  return timeout;
}
