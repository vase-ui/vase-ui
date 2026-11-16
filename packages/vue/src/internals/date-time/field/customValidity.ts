import { formatter } from '../format';
import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isKind, toInputText, toPlainDate, toPlainTime } from '../temporal';
import type { DateValue, TemporalKind, TemporalValue } from '../temporal';

/**
 * The limits of a value. A `minDate` or a `maxDate` that is a date limits whole days. One that has a
 * time is a moment: it limits the time of a value that has a time.
 */
export interface ValueLimits {
  minDate?: DateValue | undefined;
  maxDate?: DateValue | undefined;
  minTime?: Temporal.PlainTime | undefined;
  maxTime?: Temporal.PlainTime | undefined;
  unavailableDates?: DateMatcher | undefined;
}

// The default texts of the messages. A `Field.Error` or a `validate` function of the consumer can
// give other text.
export const PARTIAL_MESSAGE = 'Fill in each part.';
const UNAVAILABLE_MESSAGE = 'This date is not available.';

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
};

/** The text of a limit: its day, and its time when it has one. */
function formatLimit(
  limit: DateValue,
  locale: Intl.LocalesArgument | undefined,
  calendar: string,
): string {
  const [format, epoch] = formatter(
    limit.withCalendar(calendar),
    isKind(limit, 'date') ? DAY_FORMAT : { ...DAY_FORMAT, hour: 'numeric', minute: '2-digit' },
    locale,
  );
  return format.format(epoch);
}

function formatTime(time: Temporal.PlainTime, locale: Intl.LocalesArgument | undefined): string {
  const [format, epoch] = formatter(time, { hour: 'numeric', minute: '2-digit' }, locale);
  return format.format(epoch);
}

/** The wall clock of a value. A date is the start of its day. */
function toWallClock(value: DateValue): Temporal.PlainDateTime {
  return isKind(value, 'dateTime') ? value : value.toPlainDateTime();
}

/**
 * Negative, 0 or positive, by the day and then by the time. A date is the start of its day. Two
 * calendars and two time zones compare by their wall clocks, as `compareDates` compares by the day.
 */
export function compareMoments(a: DateValue, b: DateValue): number {
  return Temporal.PlainDateTime.compare(toWallClock(a), toWallClock(b));
}

/** The later of two minimums. It is `a` when `b` is absent or not later. */
export function laterMinimum(
  a: DateValue | undefined,
  b: DateValue | null | undefined,
): DateValue | undefined {
  return b != null && (a === undefined || compareMoments(b, a) > 0) ? b : a;
}

// A minimum that is a date limits whole days, so it compares by the day. A minimum with a time is a
// moment, and it compares by the day and the time.
function isBeforeMinimum(value: DateValue, minimum: DateValue): boolean {
  return isKind(minimum, 'date')
    ? compareDates(value, minimum) < 0
    : compareMoments(value, minimum) < 0;
}

function isAfterMaximum(value: DateValue, maximum: DateValue): boolean {
  return isKind(maximum, 'date')
    ? compareDates(value, maximum) > 0
    : compareMoments(value, maximum) > 0;
}

/**
 * The `min` and `max` of the hidden input, as text. Only the native types have them. A `minDate` or
 * a `maxDate` that is a date limits whole days, so a date and time gets the first and the last
 * moment of that day. A limit with a time gives that time, in the unit that the field shows.
 */
export function getInputLimits(
  kind: TemporalKind,
  { minDate, maxDate, minTime, maxTime }: ValueLimits,
  showSeconds: boolean,
): { min: string | undefined; max: string | undefined } {
  const day = (date: DateValue) => toInputText(toPlainDate(date), false);
  const moment = (limit: DateValue) => toInputText(toWallClock(limit), showSeconds);
  if (kind === 'date') {
    return { min: minDate && day(minDate), max: maxDate && day(maxDate) };
  }
  if (kind === 'dateTime') {
    return {
      min: minDate && (isKind(minDate, 'date') ? `${day(minDate)}T00:00` : moment(minDate)),
      max:
        maxDate &&
        (isKind(maxDate, 'date')
          ? `${day(maxDate)}T23:59${showSeconds ? ':59' : ''}`
          : moment(maxDate)),
    };
  }
  if (kind === 'time') {
    return {
      min: minTime && toInputText(minTime, showSeconds),
      max: maxTime && toInputText(maxTime, showSeconds),
    };
  }
  return { min: undefined, max: undefined };
}

/**
 * The message of the first limit that `value` breaks, or an empty text. The native input of a date,
 * of a date and time and of a time checks their own ranges, and this function checks the others:
 * the range of a zoned value and of a year and month, the time of a date and time, and the dates
 * that are not available. A year and month is in the range when one of its days is. A date of a
 * message is in `calendar`, the calendar that the field shows. A limit that is a date limits whole
 * days. A limit with a time limits the time of a zoned value too.
 */
export function getLimitMessage(
  value: TemporalValue,
  { minDate, maxDate, minTime, maxTime, unavailableDates }: ValueLimits,
  locale: Intl.LocalesArgument | undefined,
  calendar: string,
): string {
  const notBefore = (text: string) => `Enter ${text} or later.`;
  const notAfter = (text: string) => `Enter ${text} or earlier.`;

  if (isKind(value, 'zonedDateTime')) {
    if (minDate && isBeforeMinimum(value, minDate)) {
      return notBefore(formatLimit(minDate, locale, calendar));
    }
    if (maxDate && isAfterMaximum(value, maxDate)) {
      return notAfter(formatLimit(maxDate, locale, calendar));
    }
  }

  if (isKind(value, 'yearMonth')) {
    const last = value.toPlainDate({ day: value.daysInMonth });
    if (minDate && compareDates(last, minDate) < 0) {
      return notBefore(formatLimit(toPlainDate(minDate), locale, calendar));
    }
    if (maxDate && compareDates(value, maxDate) > 0) {
      return notAfter(formatLimit(toPlainDate(maxDate), locale, calendar));
    }
  }

  if (isKind(value, 'dateTime') || isKind(value, 'zonedDateTime')) {
    const time = toPlainTime(value);
    if (minTime && Temporal.PlainTime.compare(time, minTime) < 0) {
      return notBefore(formatTime(minTime, locale));
    }
    if (maxTime && Temporal.PlainTime.compare(time, maxTime) > 0) {
      return notAfter(formatTime(maxTime, locale));
    }
  }

  if (
    unavailableDates &&
    !isKind(value, 'time') &&
    !isKind(value, 'yearMonth') &&
    matches(toPlainDate(value), unavailableDates)
  ) {
    return UNAVAILABLE_MESSAGE;
  }

  return '';
}
