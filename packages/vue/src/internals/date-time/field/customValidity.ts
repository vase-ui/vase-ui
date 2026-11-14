import { formatter } from '../format';
import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isKind, toInputText, toPlainDate, toPlainTime } from '../temporal';
import type { DateValue, TemporalKind, TemporalValue } from '../temporal';

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

function formatDay(day: DateValue, locale: Intl.LocalesArgument | undefined): string {
  const [format, epoch] = formatter(
    day,
    { year: 'numeric', month: 'numeric', day: 'numeric' },
    locale,
  );
  return format.format(epoch);
}

function formatTime(time: Temporal.PlainTime, locale: Intl.LocalesArgument | undefined): string {
  const [format, epoch] = formatter(time, { hour: 'numeric', minute: '2-digit' }, locale);
  return format.format(epoch);
}

/**
 * The `min` and `max` of the hidden input, as text. Only the native types have them. A native
 * `datetime-local` input limits the day, so a limit that has no day for its end gets the first or
 * the last time of that day.
 */
export function getInputLimits(
  kind: TemporalKind,
  { minDate, maxDate, minTime, maxTime }: ValueLimits,
  showSeconds: boolean,
): { min: string | undefined; max: string | undefined } {
  const day = (date: DateValue) => toInputText(toPlainDate(date), false);
  if (kind === 'date') {
    return { min: minDate && day(minDate), max: maxDate && day(maxDate) };
  }
  if (kind === 'dateTime') {
    return {
      min: minDate && `${day(minDate)}T00:00`,
      max: maxDate && `${day(maxDate)}T23:59${showSeconds ? ':59' : ''}`,
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
 * that are not available. A year and month is in the range when one of its days is.
 */
export function getLimitMessage(
  value: TemporalValue,
  { minDate, maxDate, minTime, maxTime, unavailableDates }: ValueLimits,
  locale: Intl.LocalesArgument | undefined,
): string {
  const notBefore = (text: string) => `Enter ${text} or later.`;
  const notAfter = (text: string) => `Enter ${text} or earlier.`;

  if (isKind(value, 'zonedDateTime') || isKind(value, 'yearMonth')) {
    const first = toPlainDate(value);
    const last = isKind(value, 'yearMonth') ? value.toPlainDate({ day: value.daysInMonth }) : first;
    if (minDate && compareDates(last, minDate) < 0) {
      return notBefore(formatDay(minDate, locale));
    }
    if (maxDate && compareDates(first, maxDate) > 0) {
      return notAfter(formatDay(maxDate, locale));
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
