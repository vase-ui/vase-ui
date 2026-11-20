import type { DateTimeFieldGranularity } from '../common/date-time-field/field';
import { isKind, yearMonthInCalendar } from '../common/date-time/temporal';
import type { DatePickerRootValue } from './types';

/**
 * The template of a picker with no value, no default value and no reference date: a value of the
 * kind that the field makes for `granularity`, at midnight of `today`. A year and month is in the
 * calendar of `calendar` where that calendar has other months than ISO, so that it shows there.
 */
export function templateOf(
  granularity: DateTimeFieldGranularity | undefined,
  calendar: string | undefined,
  today: Temporal.PlainDate,
): DatePickerRootValue {
  if (granularity === 'month') {
    const month = today.toPlainYearMonth();
    return calendar === undefined || yearMonthInCalendar(month, calendar)
      ? month
      : today.withCalendar(calendar).toPlainYearMonth();
  }
  return granularity === undefined || granularity === 'day' ? today : today.toPlainDateTime();
}

/** The value has a time of day. */
export function hasTime(
  value: DatePickerRootValue,
): value is Temporal.PlainDateTime | Temporal.ZonedDateTime {
  return isKind(value, 'dateTime') || isKind(value, 'zonedDateTime');
}
