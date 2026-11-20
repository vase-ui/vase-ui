import type { DateTimeFieldGranularity } from '../../common/date-time-field/field';
import { isKind, today, yearMonthInCalendar } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';

/**
 * The value that gives a new value its kind, for a picker that has no value, no default value and
 * no reference date. It has the kind that the field makes for that granularity, and today at
 * midnight in `timeZone` for its numbers.
 *
 * A year and month of the calendar of the locale or of the `calendar` prop shows only where that
 * calendar has the same months as ISO, so it is in the calendar of the prop otherwise.
 */
export function createPickerTemplate(
  granularity: DateTimeFieldGranularity | undefined,
  calendar: string | undefined,
  timeZone: string | undefined,
): DateValue | Temporal.PlainYearMonth {
  const midnight = today(timeZone).toPlainDateTime();
  if (granularity === 'month') {
    const date = midnight.toPlainDate();
    const isoMonth = date.toPlainYearMonth();
    return calendar === undefined || yearMonthInCalendar(isoMonth, calendar)
      ? isoMonth
      : date.withCalendar(calendar).toPlainYearMonth();
  }
  return granularity === undefined || granularity === 'day' ? midnight.toPlainDate() : midnight;
}

/** Whether a value has a time of day. */
export function hasTime(value: DateValue | Temporal.PlainYearMonth): boolean {
  return isKind(value, 'dateTime') || isKind(value, 'zonedDateTime');
}
