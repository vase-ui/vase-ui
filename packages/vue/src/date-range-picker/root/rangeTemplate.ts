import { isKind, today } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import type { DateRangePickerRootGranularity } from './DateRangePickerRoot.vue';

/**
 * The end that gives a new end its kind, for a picker that has no value, no default value and no
 * reference date. It is a date for the granularity `day`, and a date with a time for each other
 * granularity. Its numbers are today at midnight in `timeZone`.
 */
export function createRangeTemplate(
  granularity: DateRangePickerRootGranularity | undefined,
  timeZone: string | undefined,
): DateValue {
  const midnight = today(timeZone).toPlainDateTime();
  return granularity === undefined || granularity === 'day' ? midnight.toPlainDate() : midnight;
}

/** Whether an end has a time of day. */
export function hasTime(end: DateValue): boolean {
  return isKind(end, 'dateTime') || isKind(end, 'zonedDateTime');
}

/** The first end that has a value, or `undefined`. */
export function firstEnd(
  range: readonly [DateValue | null, DateValue | null],
): DateValue | undefined {
  return range[0] ?? range[1] ?? undefined;
}
