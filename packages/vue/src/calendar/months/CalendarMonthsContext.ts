import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';

export interface CalendarMonthsContext {
  /** Whether the page left the grid and stays until its animations end. */
  isLeaving: (page: CalendarPage) => boolean;
  /** A page that left calls it when its animations end. The part then stops to render the page. */
  finishLeaving: (page: CalendarPage) => void;
}

export const CalendarMonthsContext: InjectionKey<CalendarMonthsContext> = Symbol();

/** A month with no `Calendar.Months` around it does not leave. */
export function useCalendarMonthsContext(): CalendarMonthsContext | undefined {
  return inject(CalendarMonthsContext, undefined);
}
