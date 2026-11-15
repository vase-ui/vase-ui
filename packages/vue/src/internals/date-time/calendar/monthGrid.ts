import { toInputText } from '../temporal';
import type { DayOfWeek } from '../temporal';

/** The seven days of a week of a page, from the first day of the week. */
export interface CalendarPageWeek {
  start: Temporal.PlainDate;
  days: Temporal.PlainDate[];
}

/**
 * The weeks that a calendar shows at one time. The first and the last week of a month can hold days
 * of the months around it. All dates are in the calendar of `yearMonth`.
 */
export interface CalendarPage {
  /** The first day of the first week. */
  start: Temporal.PlainDate;
  /** The last day of the last week. */
  end: Temporal.PlainDate;
  /** The first day that belongs to the page. The days before it belong to the page before. */
  first: Temporal.PlainDate;
  /** The last day that belongs to the page. The days after it belong to the page after. */
  last: Temporal.PlainDate;
  /**
   * The month of the page. A page of weeks or days has the month of the root: the month of its
   * first day, or the month whose first day is in its first week.
   */
  yearMonth: Temporal.PlainYearMonth;
  /** Whether the page is a duration of weeks or days. Such a page has no day outside its month. */
  isDuration: boolean;
  /** The day of the week of each column, in the order of the first row. */
  weekdays: DayOfWeek[];
  weeks: CalendarPageWeek[];
}

/**
 * The key of a page in a list. It is the first day that belongs to the page, so a new locale that
 * moves the days of the weeks, or a new name of the calendar for the same days, keeps the key.
 */
export function getPageKey(page: CalendarPage): string {
  return toInputText(page.first, false);
}

const DAYS_OF_WEEK: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

/** The seven days of the week in the order of a grid that starts on `firstDay`. */
export function weekdaysFrom(firstDay: DayOfWeek): DayOfWeek[] {
  return [...DAYS_OF_WEEK.slice(firstDay - 1), ...DAYS_OF_WEEK.slice(0, firstDay - 1)];
}

/** The day of the week of `date`, from `1` for Monday to `7` for Sunday. */
export function dayOfWeekOf(date: Temporal.PlainDate): DayOfWeek {
  return DAYS_OF_WEEK[date.dayOfWeek - 1] ?? 1;
}

/** The first day of the week that holds `date`. */
export function startOfWeek(date: Temporal.PlainDate, firstDay: DayOfWeek): Temporal.PlainDate {
  return date.subtract({ days: (date.dayOfWeek - firstDay + 7) % 7 });
}

/** Whether `date` is a day of `yearMonth`. Both must be in the same calendar. */
export function isInMonth(date: Temporal.PlainDate, yearMonth: Temporal.PlainYearMonth): boolean {
  return date.year === yearMonth.year && date.monthCode === yearMonth.monthCode;
}

/** Makes the week that starts on `start`, with `length` days. */
export function createWeek(start: Temporal.PlainDate, length = 7): CalendarPageWeek {
  return { start, days: Array.from({ length }, (_, index) => start.add({ days: index })) };
}

const WEEKS_WITH_FIXED_WEEKS = 6;

/**
 * The page of a month, in the calendar of `yearMonth`. With `fixedWeeks`, the page has six weeks,
 * and the weeks after the month hold days of the next month.
 */
export function getMonthPage(
  yearMonth: Temporal.PlainYearMonth,
  firstDay: DayOfWeek,
  fixedWeeks = false,
): CalendarPage {
  const first = yearMonth.toPlainDate({ day: 1 });
  const last = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });
  const start = startOfWeek(first, firstDay);
  const weeks: CalendarPageWeek[] = [];
  for (
    let weekStart = start;
    Temporal.PlainDate.compare(weekStart, last) <= 0 ||
    (fixedWeeks && weeks.length < WEEKS_WITH_FIXED_WEEKS);
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
