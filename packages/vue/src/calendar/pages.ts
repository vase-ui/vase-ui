import { formatRangeText, formatText } from '../common/date-time/text';
import { compareDates } from '../common/date-time/temporal';
import type { DayOfWeek } from '../common/date-time/temporal';
import type { CalendarPage, CalendarVisibleDuration, CalendarWeek } from './types';

const DAYS_OF_WEEK: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

/** The seven days of the week in the order of a grid that starts on `firstDay`. */
export function weekdaysFrom(firstDay: DayOfWeek): DayOfWeek[] {
  return [...DAYS_OF_WEEK.slice(firstDay - 1), ...DAYS_OF_WEEK.slice(0, firstDay - 1)];
}

/** The first day of the week that holds `date`. */
export function startOfWeek(date: Temporal.PlainDate, firstDay: DayOfWeek): Temporal.PlainDate {
  return date.subtract({ days: (date.dayOfWeek - firstDay + 7) % 7 });
}

/** `date` is a day of `yearMonth`. Both are in the same calendar. */
export function isInMonth(date: Temporal.PlainDate, yearMonth: Temporal.PlainYearMonth): boolean {
  return date.year === yearMonth.year && date.monthCode === yearMonth.monthCode;
}

function createWeek(start: Temporal.PlainDate, length = 7): CalendarWeek {
  return { start, days: Array.from({ length }, (_, index) => start.add({ days: index })) };
}

/**
 * The page of a month, in the calendar of `yearMonth`. With `fixedWeeks`, the page has six weeks,
 * and the weeks after the month hold days of the next month.
 */
export function getMonthPage(
  yearMonth: Temporal.PlainYearMonth,
  firstDay: DayOfWeek,
  fixedWeeks: boolean,
): CalendarPage {
  const first = yearMonth.toPlainDate({ day: 1 });
  const last = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });
  const start = startOfWeek(first, firstDay);
  const weeks: CalendarWeek[] = [];
  for (
    let weekStart = start;
    Temporal.PlainDate.compare(weekStart, last) <= 0 || (fixedWeeks && weeks.length < 6);
    weekStart = weekStart.add({ weeks: 1 })
  ) {
    weeks.push(createWeek(weekStart));
  }
  return {
    start,
    end: start.add({ days: weeks.length * 7 - 1 }),
    first,
    last,
    yearMonth,
    isDuration: false,
    weekdays: weekdaysFrom(firstDay),
    weeks,
  };
}

/**
 * The page of a broadcast month. It starts on the Monday of the week that holds the first day of
 * the month, and it ends on the Sunday before the first Monday of the next broadcast month, so it
 * has 4 or 5 weeks. With `fixedWeeks`, it has 5 weeks. `yearMonth` is in the ISO calendar.
 */
export function getBroadcastPage(
  yearMonth: Temporal.PlainYearMonth,
  fixedWeeks: boolean,
): CalendarPage {
  const start = startOfWeek(yearMonth.toPlainDate({ day: 1 }), 1);
  const next = startOfWeek(yearMonth.add({ months: 1 }).toPlainDate({ day: 1 }), 1);
  const length = fixedWeeks ? 5 : start.until(next, { largestUnit: 'days' }).days / 7;
  return {
    start,
    end: start.add({ days: length * 7 - 1 }),
    first: start,
    last: next.subtract({ days: 1 }),
    yearMonth,
    isDuration: false,
    weekdays: weekdaysFrom(1),
    weeks: Array.from({ length }, (_, index) => createWeek(start.add({ weeks: index }))),
  };
}

/** The broadcast month of `date`: the days from the Monday of the week of a first day belong to it. */
export function broadcastMonthOf(date: Temporal.PlainDate): Temporal.PlainYearMonth {
  const month = date.toPlainYearMonth();
  const next = month.add({ months: 1 });
  return compareDates(date, startOfWeek(next.toPlainDate({ day: 1 }), 1)) >= 0 ? next : month;
}

/**
 * The page of a duration that starts on `start`. Days are one row. `yearMonth` is the month of the
 * root, which a select of the page shows.
 */
export function getDurationPage(
  start: Temporal.PlainDate,
  duration: CalendarVisibleDuration,
  yearMonth: Temporal.PlainYearMonth,
): CalendarPage {
  const weeks =
    'weeks' in duration
      ? Array.from({ length: duration.weeks }, (_, index) =>
          createWeek(start.add({ weeks: index })),
        )
      : [createWeek(start, duration.days)];
  const end = start.add({ days: ('weeks' in duration ? duration.weeks * 7 : duration.days) - 1 });
  return {
    start,
    end,
    first: start,
    last: end,
    yearMonth,
    isDuration: true,
    weekdays: weeks[0]?.days.map((day) => day.dayOfWeek as DayOfWeek) ?? [],
    weeks,
  };
}

/**
 * The first day of the page of a duration that shows `date`. A page that starts at its edge moves
 * the least: forward, `date` is in the first week or the first day. Backward, it is in the last.
 */
export function alignPageStart(
  date: Temporal.PlainDate,
  duration: CalendarVisibleDuration,
  firstDay: DayOfWeek,
  edge: 'start' | 'end',
): Temporal.PlainDate {
  if ('weeks' in duration) {
    const week = startOfWeek(date, firstDay);
    return edge === 'start' ? week : week.subtract({ weeks: duration.weeks - 1 });
  }
  return edge === 'start' ? date : date.subtract({ days: duration.days - 1 });
}

/** `date` belongs to `page`, and not to the page before or after it. */
export function ownsDay(page: CalendarPage, date: Temporal.PlainDate): boolean {
  return compareDates(date, page.first) >= 0 && compareDates(date, page.last) <= 0;
}

/**
 * The number of the week that starts on `start`. Week 1 of a year is the first week that holds the
 * day `minimalDays` of January. With Monday and `4`, the number is the ISO 8601 number. `Intl` has
 * no data for the first week, and `Temporal` gives a week number only in the ISO calendar, so the
 * number comes from the ISO date.
 */
export function getWeekNumber(
  start: Temporal.PlainDate,
  firstDay: DayOfWeek,
  minimalDays: number,
): number {
  const iso = start.withCalendar('iso8601');
  const week = startOfWeek(iso, firstDay);
  const firstWeekOf = (year: number) =>
    startOfWeek(Temporal.PlainDate.from({ year, month: 1, day: minimalDays }), firstDay);
  const nextYear = firstWeekOf(iso.year + 1);
  const thisYear = firstWeekOf(iso.year);
  const firstWeek =
    compareDates(week, nextYear) >= 0
      ? nextYear
      : compareDates(week, thisYear) >= 0
        ? thisYear
        : firstWeekOf(iso.year - 1);
  return firstWeek.until(week, { largestUnit: 'days' }).days / 7 + 1;
}

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

/** The first year of the page of years that holds `year`: a multiple of `count`. */
export function getYearPageStart(year: number, count: number): number {
  return Math.floor(year / count) * count;
}

/** The years of the page that holds `month`, as the first month of each year. */
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
  return Array.from({ length: Math.ceil(cells.length / columns) }, (_, index) =>
    cells.slice(index * columns, (index + 1) * columns),
  );
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
    first: first.with({ month: 1 }).toPlainDate({ day: 1 }),
    last: lastMonth.toPlainDate({ day: lastMonth.daysInMonth }),
  };
}

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
const DURATION_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

/** The name of a page: its month, or its first and last day for a page of weeks or days. */
export function formatPage(
  page: CalendarPage,
  locale: Intl.LocalesArgument,
  format?: Intl.DateTimeFormatOptions,
): string {
  return page.isDuration
    ? formatRangeText(page.start, page.end, format ?? DURATION_FORMAT, locale)
    : formatText(page.yearMonth, format ?? MONTH_FORMAT, locale);
}

/** The name of the pages: the name of one page, or the first and the last month. */
export function formatPages(pages: readonly CalendarPage[], locale: Intl.LocalesArgument): string {
  const [first] = pages;
  const last = pages.at(-1);
  if (!first || !last || first === last) return first ? formatPage(first, locale) : '';
  return formatRangeText(first.yearMonth, last.yearMonth, MONTH_FORMAT, locale);
}

/** The name of a day of the week. The day 2024-01-01 is a Monday. */
export function formatWeekday(
  weekday: DayOfWeek,
  style: NonNullable<Intl.DateTimeFormatOptions['weekday']>,
  locale: Intl.LocalesArgument,
): string {
  const day = Temporal.PlainDate.from('2024-01-01').add({ days: weekday - 1 });
  return formatText(day, { weekday: style }, locale);
}

/** The name of a field of a date in the locale, such as `month` or `week`. */
export function formatFieldName(
  field: 'month' | 'year' | 'weekOfYear',
  locale: Intl.LocalesArgument,
): string {
  return new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of(field) ?? field;
}
