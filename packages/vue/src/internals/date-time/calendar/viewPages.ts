/** The months of the year of `month`, in its calendar. A year of some calendars has 13 months. */
export function getMonthCells(month: Temporal.PlainYearMonth): Temporal.PlainYearMonth[] {
  return Array.from({ length: month.monthsInYear }, (_, index) =>
    Temporal.PlainYearMonth.from({
      year: month.year,
      month: index + 1,
      calendar: month.calendarId,
    }),
  );
}

/**
 * The first year of the page of years that holds `year`. A page starts with a multiple of `count`,
 * so a move to another year of the page does not move the page.
 */
export function getYearPageStart(year: number, count: number): number {
  return Math.floor(year / count) * count;
}

/**
 * The years of the page that holds `month`: the first month of each year, in its calendar. A cell
 * of a year has the first month, so a year and a month are the same kind of value.
 */
export function getYearCells(
  month: Temporal.PlainYearMonth,
  count: number,
): Temporal.PlainYearMonth[] {
  const first = getYearPageStart(month.year, count);
  return Array.from({ length: count }, (_, index) =>
    Temporal.PlainYearMonth.from({ year: first + index, month: 1, calendar: month.calendarId }),
  );
}

/** The cells in rows of `columns` cells. The last row can have fewer. */
export function getRows<Cell>(cells: readonly Cell[], columns: number): Cell[][] {
  const size = Math.max(1, Math.floor(columns));
  return Array.from({ length: Math.ceil(cells.length / size) }, (_, index) =>
    cells.slice(index * size, (index + 1) * size),
  );
}

/** The state of a cell of the grid of months or of years. */
export interface CalendarCellState {
  /**
   * Whether a selected value is in the month or in the year.
   */
  selected: boolean;
  /**
   * Whether the cell can neither take focus nor be selected: the calendar is disabled, the month or
   * the year is out of `minDate` and `maxDate`, or `disabledMonths` or `disabledYears` matches it.
   */
  disabled: boolean;
  /**
   * Whether today is in the month or in the year.
   */
  current: boolean;
}

/** The first day of the year of `first`, and the last day of the year of `last`. */
export function getSpanOfYears(
  first: Temporal.PlainYearMonth,
  last: Temporal.PlainYearMonth,
): { first: Temporal.PlainDate; last: Temporal.PlainDate } {
  const lastMonth = Temporal.PlainYearMonth.from({
    year: last.year,
    month: last.monthsInYear,
    calendar: last.calendarId,
  });
  return {
    first: Temporal.PlainDate.from({
      year: first.year,
      month: 1,
      day: 1,
      calendar: first.calendarId,
    }),
    last: lastMonth.toPlainDate({ day: lastMonth.daysInMonth }),
  };
}
