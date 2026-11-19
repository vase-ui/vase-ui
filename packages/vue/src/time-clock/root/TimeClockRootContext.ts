import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type {
  Grid,
  TimeClockDayPeriodValue,
  TimeClockFaceNumber,
  TimeClockHourCycle,
  TimeClockView,
} from '../utils/clockViews';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootCommitEventDetails,
  TimeClockRootState,
  TimeClockRootViewChangeEventDetails,
} from './TimeClockRoot.vue';

export interface TimeClockRootContext {
  state: ComputedRef<TimeClockRootState>;
  view: ComputedRef<TimeClockView>;
  hourCycle: ComputedRef<TimeClockHourCycle>;
  /** The `locale` prop. A part that formats text gives it to `useFormatLocale`. */
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  grid: ComputedRef<Grid>;
  /** The numbers of the face, in the order that the face lists them. */
  numbers: ComputedRef<TimeClockFaceNumber[]>;
  /** The time that the face shows: the time of the value, or the reference time while the clock has no value. */
  time: ComputedRef<Temporal.PlainTime>;
  /** The number of the face that the time of the clock selects. */
  selectedNumber: ComputedRef<TimeClockFaceNumber>;
  /** The day period of the time of the clock. */
  dayPeriod: ComputedRef<TimeClockDayPeriodValue>;
  registerInput: (input: HTMLInputElement) => () => void;
  focusInput: () => void;
  isNumberDisabled: (number: TimeClockFaceNumber) => boolean;
  isDayPeriodDisabled: (dayPeriod: TimeClockDayPeriodValue) => boolean;
  setDragging: (dragging: boolean) => void;
  /**
   * Returns `false` when the clock does not take the number: a disabled number, a disabled or read
   * only clock, or a change that a listener cancels.
   */
  selectNumber: (number: TimeClockFaceNumber, details: TimeClockRootChangeEventDetails) => boolean;
  /** Goes a number of places forward, or back for a negative number, to the next number that is not disabled. */
  stepNumber: (places: number, details: TimeClockRootChangeEventDetails) => void;
  selectEdge: (edge: 'first' | 'last', details: TimeClockRootChangeEventDetails) => void;
  selectDayPeriod: (
    dayPeriod: TimeClockDayPeriodValue,
    details: TimeClockRootChangeEventDetails,
  ) => void;
  setView: (view: TimeClockView, details: TimeClockRootViewChangeEventDetails) => void;
  commit: (details: TimeClockRootCommitEventDetails) => void;
}

export const TimeClockRootContext: InjectionKey<TimeClockRootContext> = Symbol();

export function useTimeClockRootContext(): TimeClockRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TimeClockRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of TimeClock must be inside <TimeClock.Root>. Without a root the part has no time to show or to change. Put the part inside <TimeClock.Root>.',
    );
  }
  return context;
}

export interface TimeClockFaceContext {
  /** Makes the props of the range input of the face. The `children` component calls it in its render. */
  inputProps: () => Record<string, any>;
  /** The `ref` setter of the range input. The `children` component binds it by name. */
  setInputElement: (value: unknown) => void;
  useNumber: (
    element: Readonly<Ref<HTMLElement | null>>,
    number: () => TimeClockFaceNumber,
  ) => void;
}

export const TimeClockFaceContext: InjectionKey<TimeClockFaceContext> = Symbol();

export function useTimeClockFaceContext(optional: true): TimeClockFaceContext | undefined;
export function useTimeClockFaceContext(optional?: false): TimeClockFaceContext;
export function useTimeClockFaceContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TimeClockFaceContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: The children of <TimeClock.Face> must be inside <TimeClock.Face>. Without the face the range input has no time to show. Mount the `children` component of the `#render` slot inside the element of that slot.',
    );
  }
  return context;
}
