import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';

export interface CalendarMonthContext {
  /** The page that the month shows. */
  month: ComputedRef<CalendarPage>;
  /** The name of the month. The grid of the month has it as its `aria-label`. */
  text: ComputedRef<string>;
}

export const CalendarMonthContext: InjectionKey<CalendarMonthContext> = Symbol();

export function useCalendarMonthContext(): CalendarMonthContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarMonthContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
    );
  }

  return context;
}
