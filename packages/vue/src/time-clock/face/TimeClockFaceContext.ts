import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { TimeClockFaceNumber } from '../utils/clockViews';

export interface TimeClockFaceContext {
  /** Makes the props of the range input of the face. The `children` component calls it in its render. */
  inputProps: () => Record<string, any>;
  /** The `ref` setter of the range input. The `children` component binds it by name. */
  setInputElement: (value: unknown) => void;
  /**
   * Keeps the element of a number, so that a press can measure the outer ring. Returns the
   * function that removes the element.
   */
  registerNumber: (element: HTMLElement, number: () => TimeClockFaceNumber) => () => void;
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
