/// <reference lib="esnext.temporal" preserve="true" />

import { createError } from '../createError';

// No helper of this folder reads `Temporal` when its module loads, so an engine that has no
// `Temporal` can import it. The first read is in a function that a part calls.

export type DateValue = Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
export type TimeValue = Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime;
export type TemporalValue = DateValue | TimeValue | Temporal.PlainYearMonth;
export type TemporalKind = 'date' | 'time' | 'dateTime' | 'zonedDateTime' | 'yearMonth';

/** 1 is Monday and 7 is Sunday, as `Temporal` counts. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface KindMap {
  date: Temporal.PlainDate;
  time: Temporal.PlainTime;
  dateTime: Temporal.PlainDateTime;
  zonedDateTime: Temporal.ZonedDateTime;
  yearMonth: Temporal.PlainYearMonth;
}

const KIND_OF_TAG = new Map<string, TemporalKind>([
  ['[object Temporal.PlainDate]', 'date'],
  ['[object Temporal.PlainTime]', 'time'],
  ['[object Temporal.PlainDateTime]', 'dateTime'],
  ['[object Temporal.ZonedDateTime]', 'zonedDateTime'],
  ['[object Temporal.PlainYearMonth]', 'yearMonth'],
]);

/** Throws in a development build when the engine has no `Temporal`. A root calls it first in `setup`. */
export function assertTemporal(part: string): void {
  if (process.env.NODE_ENV !== 'production' && typeof Temporal === 'undefined') {
    throw createError(19, part);
  }
}

/**
 * The kind of a value, or `null` for each other value. The tag is the same for an object of
 * another realm and for an object of a polyfill, and `instanceof` is `false` for both.
 */
export function kindOf(value: unknown): TemporalKind | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return KIND_OF_TAG.get(Object.prototype.toString.call(value)) ?? null;
}

export function isKind<Kind extends TemporalKind>(
  value: unknown,
  kind: Kind,
): value is KindMap[Kind] {
  return kindOf(value) === kind;
}

/** Two values of the same kind and the same `equals`, or two empty values. */
export function sameTemporal(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  const kind = kindOf(a);
  return kind !== null && kind === kindOf(b) && (a as Temporal.PlainDate).equals(b as never);
}

export function toPlainDate(value: DateValue | Temporal.PlainYearMonth): Temporal.PlainDate {
  if (isKind(value, 'date')) {
    return value;
  }
  return isKind(value, 'yearMonth') ? value.toPlainDate({ day: 1 }) : value.toPlainDate();
}

export function toPlainTime(value: TimeValue): Temporal.PlainTime {
  return isKind(value, 'time') ? value : value.toPlainTime();
}

/** A value of the kind, the calendar, the time and the zone of `like`, on the day `date`. */
export function withDate<Value extends DateValue | Temporal.PlainYearMonth>(
  like: Value,
  date: Temporal.PlainDate,
): Value;
export function withDate(
  like: DateValue | Temporal.PlainYearMonth,
  date: Temporal.PlainDate,
): DateValue | Temporal.PlainYearMonth {
  const inCalendar = date.withCalendar(like.calendarId);
  if (isKind(like, 'date')) {
    return inCalendar;
  }
  if (isKind(like, 'yearMonth')) {
    return inCalendar.toPlainYearMonth();
  }
  if (isKind(like, 'dateTime')) {
    return inCalendar.toPlainDateTime(like.toPlainTime());
  }
  // A time in the gap of a zone change moves forward by the size of the gap. The same day gives
  // the same value, also in the hour that a clock repeats.
  return inCalendar.equals(like.toPlainDate())
    ? like
    : inCalendar.toZonedDateTime({ timeZone: like.timeZoneId, plainTime: like.toPlainTime() });
}

/** A value of the kind, the calendar, the date and the zone of `like`, at the time `time`. */
export function withTime<Value extends TimeValue>(like: Value, time: Temporal.PlainTime): Value;
export function withTime(like: TimeValue, time: Temporal.PlainTime): TimeValue {
  if (isKind(like, 'time')) {
    return time;
  }
  // `with` keeps the offset when it is valid for the new time. In the hour that a clock repeats, a
  // new minute then stays in the same one of the two hours.
  return like.with({
    hour: time.hour,
    minute: time.minute,
    second: time.second,
    millisecond: time.millisecond,
    microsecond: time.microsecond,
    nanosecond: time.nanosecond,
  });
}

/** Negative, 0 or positive, by the day: two calendars and two kinds compare. */
export function compareDates(
  a: DateValue | Temporal.PlainYearMonth,
  b: DateValue | Temporal.PlainYearMonth,
): number {
  return Temporal.PlainDate.compare(toPlainDate(a), toPlainDate(b));
}

export function isSameDay(a: DateValue, b: DateValue): boolean {
  return compareDates(a, b) === 0;
}

/**
 * The text of a hidden input: ISO 8601 in the ISO calendar, and RFC 9557 for a zone. A year and
 * month of a calendar that has other months than ISO has no ISO text, so its text names the
 * calendar.
 */
export function toInputText(value: TemporalValue, showSeconds: boolean): string {
  const smallestUnit = showSeconds ? 'second' : 'minute';
  if (isKind(value, 'time')) {
    return value.toString({ smallestUnit });
  }
  if (isKind(value, 'yearMonth')) {
    return (yearMonthInCalendar(value, 'iso8601') ?? value).toString();
  }
  if (isKind(value, 'date')) {
    return value.withCalendar('iso8601').toString();
  }
  return value.withCalendar('iso8601').toString({ smallestUnit });
}

/** The value of the text, or `null` when the text is not a value of the kind. */
export function parseInputText<Kind extends TemporalKind>(
  text: string,
  kind: Kind,
): KindMap[Kind] | null;
export function parseInputText(text: string, kind: TemporalKind): TemporalValue | null {
  try {
    switch (kind) {
      case 'date':
        return Temporal.PlainDate.from(text);
      case 'time':
        return Temporal.PlainTime.from(text);
      case 'dateTime':
        return Temporal.PlainDateTime.from(text);
      case 'zonedDateTime':
        return Temporal.ZonedDateTime.from(text);
      case 'yearMonth':
        return Temporal.PlainYearMonth.from(text);
    }
  } catch {
    return null;
  }
}

export function today(timeZone?: string): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(timeZone);
}

// The calendars of one list have the same months. Other calendars can have one month with the same
// days, such as the ISO month 2027-11 and the Hebrew month 5788-M02. A test of the days of one
// month thus gives a wrong answer for such a month.
const SAME_MONTHS: readonly (readonly string[])[] = [
  ['iso8601', 'gregory', 'buddhist', 'japanese', 'roc'],
  ['coptic', 'ethiopic', 'ethioaa'],
];

/**
 * `month` in another calendar, or `null` when the two calendars do not have the same months. A
 * Buddhist month is a Gregorian month, and a Persian month is not. A year and month has no
 * `withCalendar`, so the conversion goes through its first day.
 */
export function yearMonthInCalendar(
  month: Temporal.PlainYearMonth,
  calendar: string,
): Temporal.PlainYearMonth | null {
  const first = month.toPlainDate({ day: 1 }).withCalendar(calendar);
  const hasSameMonths =
    first.calendarId === month.calendarId ||
    SAME_MONTHS.some(
      (calendars) => calendars.includes(first.calendarId) && calendars.includes(month.calendarId),
    );
  return hasSameMonths ? first.toPlainYearMonth() : null;
}
