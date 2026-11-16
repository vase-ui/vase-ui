import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RangeCalendarDayState } from './RangeCalendarDay.vue';

export interface RangeCalendarDayContext {
  day: ComputedRef<Temporal.PlainDate>;
  state: ComputedRef<RangeCalendarDayState>;
}

export const RangeCalendarDayContext: InjectionKey<RangeCalendarDayContext> = Symbol();

export function useRangeCalendarDayContext(): RangeCalendarDayContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(RangeCalendarDayContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <RangeCalendar.DayButton> must be inside <RangeCalendar.Day>. Without a day the button has no date to select. Put the button inside <RangeCalendar.Day>.',
    );
  }

  return context;
}
