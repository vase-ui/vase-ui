import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';

export interface CalendarDayContext {
  day: ComputedRef<Temporal.PlainDate>;
  state: ComputedRef<DayState>;
}

export const CalendarDayContext: InjectionKey<CalendarDayContext> = Symbol();

export function useCalendarDayContext(): CalendarDayContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarDayContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Calendar.DayButton> must be inside <Calendar.Day>. Without a day the button has no date to select. Put the button inside <Calendar.Day>.',
    );
  }

  return context;
}
