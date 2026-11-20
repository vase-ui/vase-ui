import { isKind } from './temporal';
import type { TemporalValue } from './temporal';

/**
 * The formatter for `value` and the number that it formats. `Intl` gets a number, a zone and a
 * calendar, and never a `Temporal` object. A polyfill then does not have to patch `Intl`, and a
 * calendar that is not the one of the locale does not throw. The calendar and the zone of `value`
 * replace those of `options`. A value that has no zone shows its clock in UTC.
 */
export function formatter(
  value: TemporalValue,
  options: Intl.DateTimeFormatOptions,
  locale: Intl.LocalesArgument,
): [format: Intl.DateTimeFormat, epochMilliseconds: number] {
  if (isKind(value, 'zonedDateTime')) {
    return [
      new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: value.timeZoneId,
        calendar: intlCalendar(value.calendarId),
      }),
      value.epochMilliseconds,
    ];
  }
  if (isKind(value, 'time')) {
    const moment = Temporal.PlainDate.from('1970-01-01')
      .toPlainDateTime(value)
      .toZonedDateTime('UTC');
    return [
      new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }),
      moment.epochMilliseconds,
    ];
  }
  const day = isKind(value, 'yearMonth') ? value.toPlainDate({ day: 1 }) : value;
  return [
    new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: 'UTC',
      calendar: intlCalendar(value.calendarId),
    }),
    day.toZonedDateTime('UTC').epochMilliseconds,
  ];
}

// `Intl` formats the calendar `iso8601` as `2026 January 31`.
function intlCalendar(calendar: string): string {
  return calendar === 'iso8601' ? 'gregory' : calendar;
}

/** Whether `Temporal` has the calendar `calendar`. */
export function isTemporalCalendar(calendar: string): boolean {
  try {
    Temporal.PlainDate.from('1970-01-01').withCalendar(calendar);
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar of a locale, such as `gregory`, `buddhist` or `persian`: its `-u-ca-` keyword, else
 * its default. `Intl` and `Temporal` do not have the same calendars. Chromium resolves
 * `ar-SA-u-ca-islamic` to `islamic`, which `Temporal` refuses, and `temporal-polyfill` without its
 * `full` entry has only `iso8601` and `gregory`. For such a calendar the result is `gregory`.
 */
export function localeCalendar(locale: Intl.LocalesArgument): string {
  const calendar = new Intl.DateTimeFormat(locale).resolvedOptions().calendar;
  return isTemporalCalendar(calendar) ? calendar : 'gregory';
}

/** The ten digits of the numbering system of a locale, from 0 to 9. */
export function digits(locale: Intl.LocalesArgument): string[] {
  const format = new Intl.NumberFormat(locale, { useGrouping: false });
  return Array.from({ length: 10 }, (_, digit) => format.format(digit));
}

/** The hour cycle that a locale uses. */
export function hourCycleOf(locale: Intl.LocalesArgument): 12 | 24 {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24;
}

/**
 * The text of a day period in a locale, such as `AM` and `PM`. The 12-hour format of each locale
 * has a day period, also for a locale that uses the 24-hour cycle.
 */
export function dayPeriodText(period: 'am' | 'pm', locale: Intl.LocalesArgument): string {
  const [format, epochMilliseconds] = formatter(
    new Temporal.PlainTime(period === 'pm' ? 21 : 9),
    { hour: 'numeric', hour12: true },
    locale,
  );
  return (
    format.formatToParts(epochMilliseconds).find((part) => part.type === 'dayPeriod')?.value ?? ''
  );
}
