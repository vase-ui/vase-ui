import type { DayOfWeek } from '../temporal';

/** The seven days of a week of a page, from the first day of the week. */
export interface CalendarPageWeek {
  start: Temporal.PlainDate;
  days: Temporal.PlainDate[];
}

/**
 * The weeks that show one month. The first and the last week can hold days of the months around
 * it. All dates are in the calendar of `yearMonth`.
 */
export interface CalendarPage {
  /** The first day of the first week. */
  start: Temporal.PlainDate;
  /** The last day of the last week. */
  end: Temporal.PlainDate;
  yearMonth: Temporal.PlainYearMonth;
  weeks: CalendarPageWeek[];
}

const DAYS_OF_WEEK: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

/** The seven days of the week in the order of a grid that starts on `firstDay`. */
export function weekdaysFrom(firstDay: DayOfWeek): DayOfWeek[] {
  return [...DAYS_OF_WEEK.slice(firstDay - 1), ...DAYS_OF_WEEK.slice(0, firstDay - 1)];
}

/** The first day of the week that holds `date`. */
export function startOfWeek(date: Temporal.PlainDate, firstDay: DayOfWeek): Temporal.PlainDate {
  return date.subtract({ days: (date.dayOfWeek - firstDay + 7) % 7 });
}

/** Whether `date` is a day of `yearMonth`. Both must be in the same calendar. */
export function isInMonth(date: Temporal.PlainDate, yearMonth: Temporal.PlainYearMonth): boolean {
  return date.year === yearMonth.year && date.monthCode === yearMonth.monthCode;
}

/** The page of a month, in the calendar of `yearMonth`. */
export function getMonthPage(
  yearMonth: Temporal.PlainYearMonth,
  firstDay: DayOfWeek,
): CalendarPage {
  const lastDay = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });
  const start = startOfWeek(yearMonth.toPlainDate({ day: 1 }), firstDay);
  const weeks: CalendarPageWeek[] = [];
  for (
    let weekStart = start;
    Temporal.PlainDate.compare(weekStart, lastDay) <= 0;
    weekStart = weekStart.add({ weeks: 1 })
  ) {
    const first = weekStart;
    weeks.push({
      start: first,
      days: Array.from({ length: 7 }, (_, index) => first.add({ days: index })),
    });
  }
  return { start, end: startOfWeek(lastDay, firstDay).add({ days: 6 }), yearMonth, weeks };
}
