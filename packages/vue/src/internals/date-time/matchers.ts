import { compareDates, isKind, isSameDay } from './temporal';
import type { DateValue } from './temporal';

/**
 * A rule for the days of a grid. Each form but the function and the list compares by the day:
 * - a date matches that day;
 * - `{ start, end }` matches the days from `start` to `end`, the two ends included;
 * - `{ before }` and `{ after }` match the days that come before or after that day;
 * - `{ before, after }` matches the days between the two, the two ends excluded;
 * - `{ dayOfWeek }` matches each day of the week that it names, from Monday (1) to Sunday (7);
 * - a function matches the days for which it returns `true`;
 * - a list matches the days that one of its matchers matches.
 */
export type DateMatcher =
  | DateValue
  | { start: DateValue; end: DateValue }
  | { before: DateValue; after?: DateValue }
  | { after: DateValue; before?: DateValue }
  | { dayOfWeek: number | readonly number[] }
  | ((date: Temporal.PlainDate) => boolean)
  | readonly DateMatcher[];

interface Bounds {
  start?: DateValue | undefined;
  end?: DateValue | undefined;
  before?: DateValue | undefined;
  after?: DateValue | undefined;
}

function isList(matcher: DateMatcher): matcher is readonly DateMatcher[] {
  return Array.isArray(matcher);
}

function isDate(matcher: DateMatcher): matcher is DateValue {
  return isKind(matcher, 'date') || isKind(matcher, 'dateTime') || isKind(matcher, 'zonedDateTime');
}

// A bound that is absent does not limit the days. A matcher with no bound matches no day.
function isWithinBounds(date: Temporal.PlainDate, { start, end, before, after }: Bounds): boolean {
  if (start === undefined && end === undefined && before === undefined && after === undefined) {
    return false;
  }
  return (
    (start === undefined || compareDates(date, start) >= 0) &&
    (end === undefined || compareDates(date, end) <= 0) &&
    (before === undefined || compareDates(date, before) < 0) &&
    (after === undefined || compareDates(date, after) > 0)
  );
}

/** Says whether `matcher` matches `date`. A day with another calendar than the matcher compares by its day. */
export function matches(date: Temporal.PlainDate, matcher: DateMatcher | undefined): boolean {
  if (matcher === undefined) {
    return false;
  }
  if (typeof matcher === 'function') {
    return matcher(date);
  }
  if (isList(matcher)) {
    return matcher.some((item) => matches(date, item));
  }
  if (isDate(matcher)) {
    return isSameDay(date, matcher);
  }
  if ('dayOfWeek' in matcher) {
    const { dayOfWeek } = matcher;
    return typeof dayOfWeek === 'number'
      ? dayOfWeek === date.dayOfWeek
      : dayOfWeek.some((day) => day === date.dayOfWeek);
  }
  return isWithinBounds(date, matcher);
}
