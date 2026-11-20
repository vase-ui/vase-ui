import { computed, mergeProps, nextTick, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectMonth } from './month';
import { formatFieldName } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarPage, CalendarSelectOption, CalendarState } from './types';

/**
 * `Calendar.MonthSelect` and `Calendar.YearSelect`. A select in `Calendar.Month` is for the page of
 * that month, and else for the first page.
 */
export function useCalendarSelect(options: {
  field: 'month' | 'year';
  options: (page: CalendarPage) => CalendarSelectOption[];
  /** The `value` of the option that a page shows. */
  value: (page: CalendarPage) => string;
  /** The month of an option for a page. */
  month: (page: CalendarPage, value: string) => Temporal.PlainYearMonth;
}) {
  const calendar = injectCalendar();
  const month = injectMonth();
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLSelectElement>();
  const page = computed(() => month?.page ?? calendar.pages[0]);
  const selectOptions = computed(() => (page.value ? options.options(page.value) : []));
  const value = computed(() => (page.value ? options.value(page.value) : ''));
  // With no page, the select has no month to show.
  const state = computed<CalendarState>(() => ({
    ...calendar.state,
    disabled: calendar.state.disabled || !page.value,
  }));

  function onChange(event: Event) {
    const current = page.value;
    const select = event.currentTarget as HTMLSelectElement;
    if (!current) return;
    const index = calendar.pages.findIndex((other) => other.first.equals(current.first));
    calendar.showMonth(options.month(current, select.value), Math.max(0, index), event);
    // A listener can cancel the move, and a parent can keep its month. Vue writes an option only
    // when its binding changes, so the select shows the month of the page again.
    void nextTick(() => {
      if (element.value) element.value.value = value.value;
    });
  }

  return {
    element,
    setElement,
    state,
    options: selectOptions,
    value,
    elementProps: () =>
      mergeProps(
        {
          'aria-label': formatFieldName(options.field, calendar.locale),
          disabled: state.value.disabled ? '' : undefined,
          onChange,
          ...stateAttributes(state.value, ['disabled']),
        },
        attrs,
      ),
  };
}
