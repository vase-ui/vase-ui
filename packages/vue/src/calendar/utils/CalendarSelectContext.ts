import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface CalendarSelectOption {
  value: string;
  text: string;
  disabled: boolean;
}

/** What `Calendar.MonthSelect` and `Calendar.YearSelect` give to the options that they render. */
export interface CalendarSelectContext {
  options: ComputedRef<CalendarSelectOption[]>;
  /** The `value` of the option that the select shows. */
  selected: ComputedRef<string>;
}

export const CalendarSelectContext: InjectionKey<CalendarSelectContext> = Symbol();

export function useCalendarSelectContext(): CalendarSelectContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CalendarSelectContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The options of a calendar select must be inside <Calendar.MonthSelect> or <Calendar.YearSelect>. Without the select the options have no months or years to show. Mount the `children` component of the `#render` slot inside the select.',
    );
  }

  return context;
}
