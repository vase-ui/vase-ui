import { computed, provide } from 'vue';
import { getPageKey } from '../../internals/date-time/calendar/monthGrid';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import type { CalendarRootContext } from '../root/CalendarRootContext';
import { CalendarSelectContext } from './CalendarSelectContext';
import type { CalendarSelectOption } from './CalendarSelectContext';

interface UseCalendarSelectParameters {
  root: CalendarRootContext;
  /** The options of the select for a page. */
  getOptions: (page: CalendarPage) => CalendarSelectOption[];
  /** The `value` of the option that a page shows. */
  getValue: (page: CalendarPage) => string;
  /** The month that an option of the select means for a page. */
  getMonth: (page: CalendarPage, value: string) => Temporal.PlainYearMonth;
}

/**
 * Shared implementation of the two selects. A select inside `Calendar.Month` is for the page of
 * that month. Outside a month, it is for the first page.
 */
export function useCalendarSelect({
  root,
  getOptions,
  getValue,
  getMonth,
}: UseCalendarSelectParameters) {
  const monthContext = useCalendarMonthContext(true);

  const page = computed(() => monthContext?.month.value ?? root.pages.value[0]);
  // The page of a month that leaves has no index, and the first page replaces it.
  const pageIndex = computed(() => {
    const current = page.value;
    const index = current
      ? root.pages.value.findIndex((other) => getPageKey(other) === getPageKey(current))
      : -1;
    return Math.max(0, index);
  });

  const options = computed(() => (page.value ? getOptions(page.value) : []));
  const selected = computed(() => (page.value ? getValue(page.value) : ''));
  provide(CalendarSelectContext, { options, selected });

  function onChange(event: Event) {
    const select = event.currentTarget;
    const current = page.value;
    if (!(select instanceof HTMLSelectElement) || !current) {
      return;
    }
    root.showMonth(getMonth(current, select.value), pageIndex.value, event);
    // The root decides the month. A listener can cancel the change, and a controlled month waits
    // for its value, so the select shows the month of the root again.
    select.value = selected.value;
  }

  return { onChange };
}
