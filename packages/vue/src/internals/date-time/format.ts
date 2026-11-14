import { isKind } from './temporal';
import type { DayOfWeek, TemporalValue } from './temporal';

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

/** The calendar of a locale, such as `gregory`, `buddhist` or `persian`: its `-u-ca-` keyword, else its default. */
export function localeCalendar(locale: Intl.LocalesArgument): string {
  return new Intl.DateTimeFormat(locale).resolvedOptions().calendar;
}

export interface WeekInfo {
  firstDay: DayOfWeek;
  weekend: DayOfWeek[];
}

function isDayOfWeek(value: unknown): value is DayOfWeek {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function toWeekInfo(info: unknown): WeekInfo | null {
  if (typeof info !== 'object' || info === null) {
    return null;
  }
  const firstDay: unknown = Reflect.get(info, 'firstDay');
  const weekend: unknown = Reflect.get(info, 'weekend');
  if (!isDayOfWeek(firstDay) || !Array.isArray(weekend) || !weekend.every(isDayOfWeek)) {
    return null;
  }
  return { firstDay, weekend: [...weekend] };
}

// The first locale that `Intl` supports, with its keywords such as `-u-fw-mon`, which `resolvedOptions`
// drops. A locale with no format data gives the week of its region.
function localeTag(locale: Intl.LocalesArgument): string {
  const list =
    typeof locale === 'string' || locale instanceof Intl.Locale ? [locale] : (locale ?? []);
  const tags = list.map(String);
  return (
    Intl.DateTimeFormat.supportedLocalesOf(tags)[0] ??
    tags[0] ??
    new Intl.DateTimeFormat().resolvedOptions().locale
  );
}

/**
 * The first day and the weekend of a locale. Chrome before 130 and Safari before 17 have the
 * accessor `weekInfo` and no method `getWeekInfo`. Firefox before 153 has neither, so the result
 * is the ISO 8601 week: it starts on Monday, and the weekend is Saturday and Sunday.
 */
export function weekInfo(locale: Intl.LocalesArgument): WeekInfo {
  const resolved = new Intl.Locale(localeTag(locale));
  const method: unknown = Reflect.get(resolved, 'getWeekInfo');
  const info: unknown =
    typeof method === 'function'
      ? Reflect.apply(method, resolved, [])
      : Reflect.get(resolved, 'weekInfo');
  return toWeekInfo(info) ?? { firstDay: 1, weekend: [6, 7] };
}

/** The ten digits of the numbering system of a locale, from 0 to 9. */
export function digits(locale: Intl.LocalesArgument): string[] {
  const format = new Intl.NumberFormat(locale, { useGrouping: false });
  return Array.from({ length: 10 }, (_, digit) => format.format(digit));
}
