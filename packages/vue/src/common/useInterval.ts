import { onScopeDispose } from 'vue';
import { Timeout } from './useTimeout';

type IntervalId = number;

const EMPTY = 0 as IntervalId;

export class Interval extends Timeout {
  static override create() {
    return new Interval();
  }

  override start(delay: number, fn: () => void) {
    this.clear();
    this.currentId = setInterval(() => {
      fn();
    }, delay) as unknown as number;
  }

  override clear = () => {
    if (this.currentId !== EMPTY) {
      clearInterval(this.currentId);
      this.currentId = EMPTY;
    }
  };
}

export function useInterval() {
  const interval = Interval.create();
  onScopeDispose(interval.clear);
  return interval;
}
