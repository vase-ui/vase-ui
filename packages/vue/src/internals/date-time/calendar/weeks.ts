import { compareDates } from '../temporal';
import type { DayOfWeek } from '../temporal';
import { createWeek, dayOfWeekOf, startOfWeek, weekdaysFrom } from './monthGrid';
import type { CalendarPage } from './monthGrid';

/** The weeks or the days that one page of a calendar shows, in place of a month. */
export type VisibleDuration = { weeks: number } | { days: number };

const BROADCAST_FIRST_DAY = 1;
const BROADCAST_FIXED_WEEKS = 5;

/**
 * The number of the week that holds `date`. The first week of a year is the first week that has
 * `minimalDays` days in that year, so that the day `minimalDays` of January is always in it. With
 * Monday as `firstDay` and `4`, the number is the ISO 8601 number. A week of the days at the end of
 * a year can have the number of the first week of the next year.
 * `Intl` has no data for the first week, and `Temporal` gives a week number only in the ISO
 * calendar, so the number is read from the ISO date of `date`.
 */
export function getWeekNumber(
  date: Temporal.PlainDate,
  firstDay: DayOfWeek,
  minimalDays: number,
): number {
  const iso = date.withCalendar('iso8601');
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

/**
 * The page of a broadcast month. It starts on the Monday of the week that holds the first day of
 * the month, and it ends on the Sunday before the first Monday of the next broadcast month, so it
 * has 4 or 5 weeks. With `fixedWeeks`, it has 5 weeks. `yearMonth` must be in the ISO calendar.
 */
export function getBroadcastPage(
  yearMonth: Temporal.PlainYearMonth,
  fixedWeeks = false,
): CalendarPage {
  const start = startOfWeek(yearMonth.toPlainDate({ day: 1 }), BROADCAST_FIRST_DAY);
  const next = startOfWeek(
    yearMonth.add({ months: 1 }).toPlainDate({ day: 1 }),
    BROADCAST_FIRST_DAY,
  );
  const length = fixedWeeks
    ? BROADCAST_FIXED_WEEKS
    : start.until(next, { largestUnit: 'days' }).days / 7;
  const weeks = Array.from({ length }, (_, index) => createWeek(start.add({ weeks: index })));
  return {
    start,
    end: start.add({ days: length * 7 - 1 }),
    first: start,
    last: next.subtract({ days: 1 }),
    yearMonth,
    isDuration: false,
    weekdays: weekdaysFrom(BROADCAST_FIRST_DAY),
    weeks,
  };
}

/**
 * The page of a duration. `start` is its first day: a day of `firstDay` for weeks. Days are one row.
 */
export function getDurationPage(
  start: Temporal.PlainDate,
  duration: VisibleDuration,
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
    yearMonth: start.toPlainYearMonth(),
    isDuration: true,
    weekdays: weeks[0]?.days.map((day) => dayOfWeekOf(day)) ?? [],
    weeks,
  };
}

/**
 * The first day of the page of a duration that shows `date`. A page that starts at its edge moves
 * the least: forward, `date` is in the first week or the first day. Backward, it is in the last.
 */
export function alignPageStart(
  date: Temporal.PlainDate,
  duration: VisibleDuration,
  firstDay: DayOfWeek,
  edge: 'start' | 'end',
): Temporal.PlainDate {
  if ('weeks' in duration) {
    const week = startOfWeek(date, firstDay);
    return edge === 'start' ? week : week.subtract({ weeks: duration.weeks - 1 });
  }
  return edge === 'start' ? date : date.subtract({ days: duration.days - 1 });
}

/** The duration as an argument of `add` and `subtract`. */
export function toDurationLike(duration: VisibleDuration): Temporal.DurationLike {
  return 'weeks' in duration ? { weeks: duration.weeks } : { days: duration.days };
}
