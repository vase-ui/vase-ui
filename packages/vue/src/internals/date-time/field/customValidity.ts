import { formatter } from '../format';
import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isKind, toInputText, toPlainDate, toPlainTime } from '../temporal';
import type { DateValue, TemporalKind, TemporalValue } from '../temporal';

/**
 * The limits of a value. A `minDate` or a `maxDate` that is a date limits whole days. One that has a
 * time is a moment: it limits the time of a value that has a time. A zoned moment limits a zoned
 * value by the moment, and any other value by its wall clock.
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

/**
 * The text of a limit for the message about a zoned value. A zoned limit shows in the zone of the
 * value, which is the zone that the field shows. A least limit rounds up to the minute, so that
 * the value that the message names is valid, and a greatest limit shows as its minute.
 */
function formatLimitForZoned(
  limit: DateValue,
  zone: string,
  isLeast: boolean,
  locale: Intl.LocalesArgument | undefined,
  calendar: string,
): string {
  if (isKind(limit, 'date')) {
    return formatLimit(limit, locale, calendar);
  }
  const local = isKind(limit, 'zonedDateTime') ? limit.withTimeZone(zone) : limit;
  const wallClock = toWallClock(local);
  return formatLimit(
    isLeast ? wallClock.round({ smallestUnit: 'minute', roundingMode: 'ceil' }) : wallClock,
    locale,
    calendar,
  );
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
 * Negative, 0 or positive. Two zoned values compare by the moment, also when their time zones
 * differ. Else the values compare by their wall clocks, by the day and then by the time, and a date
 * is the start of its day. Two calendars compare by their days, as `compareDates` does.
 */
export function compareMoments(a: DateValue, b: DateValue): number {
  if (isKind(a, 'zonedDateTime') && isKind(b, 'zonedDateTime')) {
    return Temporal.ZonedDateTime.compare(a, b);
  }
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
 * moment of that day. A limit with a time gives that time, in the unit that the input has: a minute,
 * or a second when `showSeconds`. The text of a value has no more than that unit, and the step base
 * of the input is its `min`, so a least limit rounds up and a greatest limit rounds down.
 */
export function getInputLimits(
  kind: TemporalKind,
  { minDate, maxDate, minTime, maxTime }: ValueLimits,
  showSeconds: boolean,
): { min: string | undefined; max: string | undefined } {
  const day = (date: DateValue) => toInputText(toPlainDate(date), false);
  const leastMoment = (limit: DateValue) =>
    toInputText(
      toWallClock(limit).round({
        smallestUnit: showSeconds ? 'second' : 'minute',
        roundingMode: 'ceil',
      }),
      showSeconds,
    );
  // The text of a moment has no more than the unit, so it already rounds down.
  const greatestMoment = (limit: DateValue) => toInputText(toWallClock(limit), showSeconds);
  if (kind === 'date') {
    return { min: minDate && day(minDate), max: maxDate && day(maxDate) };
  }
  if (kind === 'dateTime') {
    return {
      min: minDate && (isKind(minDate, 'date') ? `${day(minDate)}T00:00` : leastMoment(minDate)),
      max:
        maxDate &&
        (isKind(maxDate, 'date')
          ? `${day(maxDate)}T23:59${showSeconds ? ':59' : ''}`
          : greatestMoment(maxDate)),
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
 * days. A limit with a time limits the time of a zoned value too, as `compareMoments` compares.
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
    const zone = value.timeZoneId;
    if (minDate && isBeforeMinimum(value, minDate)) {
      return notBefore(formatLimitForZoned(minDate, zone, true, locale, calendar));
    }
    if (maxDate && isAfterMaximum(value, maxDate)) {
      return notAfter(formatLimitForZoned(maxDate, zone, false, locale, calendar));
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
