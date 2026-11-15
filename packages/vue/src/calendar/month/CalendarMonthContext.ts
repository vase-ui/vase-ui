import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import type { UseLabelIdReturnValue } from '../../utils/useRegisteredLabelId';

export interface CalendarMonthContext extends Pick<
  UseLabelIdReturnValue,
  'defaultLabelId' | 'setLabelId' | 'getAriaLabelledBy'
> {
  /** The page that the month shows. */
  month: ComputedRef<CalendarPage>;
  /** The name of the month. The grid of the month has it as its `aria-label`. */
  text: ComputedRef<string>;
  /** Whether the month left the calendar and stays until its animations end. */
  isLeaving: ComputedRef<boolean>;
}

export const CalendarMonthContext: InjectionKey<CalendarMonthContext> = Symbol();

export function useCalendarMonthContext(optional: true): CalendarMonthContext | undefined;
export function useCalendarMonthContext(optional?: false): CalendarMonthContext;
export function useCalendarMonthContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarMonthContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
    );
  }

  return context;
}
