import { localeCalendar } from './format';
import { isKind, yearMonthInCalendar } from './temporal';
import type { TemporalValue } from './temporal';

/**
 * The calendar in which a part shows `value`: `calendar`, else the calendar of the value when it
 * is not ISO, else the calendar of the locale. `gregory` as `calendar` shows Gregorian dates in
 * each locale. A year and month shows in that calendar only where the calendar has the same months.
 * Else it shows in its own calendar.
 */
export function displayCalendar(
  calendar: string | undefined,
  value: TemporalValue | null | undefined,
  locale: Intl.LocalesArgument,
): string {
  if (value === null || value === undefined || isKind(value, 'time')) {
    return calendar ?? localeCalendar(locale);
  }
  const ownCalendar = value.calendarId === 'iso8601' ? undefined : value.calendarId;
  const display = calendar ?? ownCalendar ?? localeCalendar(locale);
  return isKind(value, 'yearMonth') && !yearMonthInCalendar(value, display)
    ? value.calendarId
    : display;
}
