import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { RangeSelection } from '../../internals/date-time/calendar/rangeSelection';

export const RangeCalendarRootContext: InjectionKey<RangeSelection> = Symbol();

export function useRangeCalendarRootContext(): RangeSelection {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(RangeCalendarRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of RangeCalendar must be inside <RangeCalendar.Root>. Without a root the part has no range to show. Put the part inside <RangeCalendar.Root>.',
    );
  }

  return context;
}
