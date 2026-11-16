import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { CalendarRootController } from '../../internals/date-time/calendar/useCalendarRoot';
import type { CalendarState } from './CalendarRoot.vue';

export interface CalendarRootContext extends Omit<CalendarRootController, 'focus'> {
  state: ComputedRef<CalendarState>;
}

export const CalendarRootContext: InjectionKey<CalendarRootContext> = Symbol();

export function useCalendarRootContext(): CalendarRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );
  }

  return context;
}
