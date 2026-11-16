import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/** What `Calendar.MonthGrid` and `Calendar.YearGrid` give to their cells. */
export interface CalendarViewGridContext {
  /** The cells of a row. A key that moves up or down moves the focus by a row. */
  columns: ComputedRef<number>;
}

export const CalendarViewGridContext: InjectionKey<CalendarViewGridContext> = Symbol();

export function useCalendarViewGridContext(): CalendarViewGridContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarViewGridContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A month cell or a year cell of Calendar must be inside <Calendar.MonthGrid> or <Calendar.YearGrid>. Without the grid the cell has no row, so the keys cannot move the focus by a row. Put the cell inside its grid.',
    );
  }

  return context;
}
