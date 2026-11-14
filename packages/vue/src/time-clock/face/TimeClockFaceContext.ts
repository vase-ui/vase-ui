import { inject } from 'vue';
import type { InjectionKey } from 'vue';

export interface TimeClockFaceContext {
  /** Makes the props of the range input of the face. The `children` component calls it in its render. */
  inputProps: () => Record<string, any>;
}

export const TimeClockFaceContext: InjectionKey<TimeClockFaceContext> = Symbol();

export function useTimeClockFaceContext(): TimeClockFaceContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TimeClockFaceContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The children of <TimeClock.Face> must be inside <TimeClock.Face>. Without the face the range input has no time to show. Mount the `children` component of the `#render` slot inside the element of that slot.',
    );
  }
  return context;
}
