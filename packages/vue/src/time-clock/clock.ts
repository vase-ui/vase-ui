import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootCommitEventDetails,
  TimeClockRootState,
  TimeClockRootViewChangeEventDetails,
} from './types';
import type {
  Grid,
  TimeClockDayPeriodValue,
  TimeClockFaceNumber,
  TimeClockHourCycle,
  TimeClockView,
} from './views';

/** What `TimeClock.Root` gives to its parts. The properties are reactive. */
export interface ClockForPart {
  readonly state: TimeClockRootState;
  readonly view: TimeClockView;
  readonly hourCycle: TimeClockHourCycle;
  readonly locale: Intl.LocalesArgument;
  /** The time that the face shows: of the value, else of `referenceDate`, else 00:00. */
  readonly time: Temporal.PlainTime;
  readonly grid: Grid;
  /** The numbers of the face, clockwise, the outer ring first. */
  readonly numbers: readonly TimeClockFaceNumber[];
  /** The number of `time` in the view. */
  readonly selectedNumber: TimeClockFaceNumber;
  readonly dayPeriod: TimeClockDayPeriodValue;
  /** The elements of the numbers of the outer ring. */
  readonly outerNumbers: readonly Element[];
  isNumberDisabled(number: TimeClockFaceNumber): boolean;
  isDayPeriodDisabled(period: TimeClockDayPeriodValue): boolean;
  /** Returns `false` when the clock does not take the number. */
  selectNumber(number: TimeClockFaceNumber, details: TimeClockRootChangeEventDetails): boolean;
  /** Goes `places` enabled numbers forward, or back for a negative number. */
  stepNumber(places: number, details: TimeClockRootChangeEventDetails): void;
  selectEdge(edge: 'first' | 'last', details: TimeClockRootChangeEventDetails): void;
  selectDayPeriod(period: TimeClockDayPeriodValue, details: TimeClockRootChangeEventDetails): void;
  setView(view: TimeClockView, details: TimeClockRootViewChangeEventDetails): void;
  commit(details: TimeClockRootCommitEventDetails): void;
  setDragging(dragging: boolean): void;
  /** The range input of the face, which the time picker focuses. */
  setRangeInput(input: HTMLInputElement | null): void;
  /** Adds the element of a number. Returns the function that removes it. */
  addNumber(element: Element, number: () => TimeClockFaceNumber): () => void;
}

export const clockKey: InjectionKey<ClockForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'time clock' : undefined,
);

export function injectClock(): ClockForPart {
  const clock = inject(clockKey, null);
  if (!clock) {
    throw createError(65);
  }
  return clock;
}

/** The data attributes of the state of the clock. */
export function clockAttributes(state: TimeClockRootState) {
  const on = (flag: boolean) => (flag ? '' : undefined);
  return {
    'data-view': state.view,
    'data-disabled': on(state.disabled),
    'data-readonly': on(state.readonly),
    'data-dragging': on(state.dragging),
    'data-empty': on(state.empty),
  };
}
