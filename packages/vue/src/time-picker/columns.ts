import { formatNumber } from '../common/formatNumber';
import { dayPeriodText } from '../common/date-time/format';
import {
  dayPeriodOf,
  faceNumber,
  faceNumberOf,
  isTimeAllowed,
  timeOfDayPeriod,
  timeOfFaceNumber,
} from '../time-clock/views';
import type {
  TimeClockDayPeriodValue,
  TimeClockHourCycle,
  TimeClockView,
  TimeLimits,
} from '../time-clock/views';

/** The unit that a column of the time picker sets. */
export type TimePickerColumnUnit = TimeClockView | 'dayPeriod';

/** A number for a column of hours, minutes or seconds, and a day period for a column of day periods. */
export type TimePickerColumnValue = number | TimeClockDayPeriodValue;

/**
 * The values of a column, in the order of the day. An hour of a 12-hour cycle goes from 12 to 11,
 * because 12 AM is the first hour of the day. `step` must be a whole number above 0.
 */
export function columnValues(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  step: number,
): TimePickerColumnValue[] {
  if (unit === 'dayPeriod') {
    return ['am', 'pm'];
  }
  if (unit === 'hour') {
    return Array.from({ length: hourCycle }, (_, hour) => hour)
      .filter((hour) => hour % step === 0)
      .map((hour) => (hourCycle === 12 && hour === 0 ? 12 : hour));
  }
  return Array.from({ length: Math.ceil(60 / step) }, (_, place) => place * step);
}

/** The value that `time` has in a column. */
export function selectedColumnValue(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
): TimePickerColumnValue {
  return unit === 'dayPeriod' ? dayPeriodOf(time) : faceNumberOf(unit, hourCycle, time).value;
}

/** `time` with the unit of the column set to `value`. An hour of a 12-hour cycle keeps the day period. */
export function timeOfColumnValue(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
  value: TimePickerColumnValue,
): Temporal.PlainTime {
  if (unit === 'dayPeriod') {
    return timeOfDayPeriod(time, value === 'pm' ? 'pm' : 'am');
  }
  return timeOfFaceNumber(unit, hourCycle, time, faceNumber(unit, hourCycle, Number(value)));
}

/**
 * Whether a person can select `value` in a column. A day period is selectable when one of its
 * hours is, as for the day period of the clock.
 */
export function isColumnValueAllowed(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
  value: TimePickerColumnValue,
  limits: TimeLimits,
): boolean {
  if (unit === 'dayPeriod') {
    const firstHour = value === 'pm' ? 12 : 0;
    return Array.from({ length: 12 }, (_, hour) => time.with({ hour: firstHour + hour })).some(
      (candidate) => isTimeAllowed(candidate, 'hour', limits),
    );
  }
  return isTimeAllowed(timeOfColumnValue(unit, hourCycle, time, value), unit, limits);
}

/**
 * The text of `value` in a column: the digits of the locale, with two digits except for an hour of
 * a 12-hour cycle, and the day period of the locale.
 */
export function columnText(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  value: TimePickerColumnValue,
  locale: Intl.LocalesArgument,
): string {
  if (unit === 'dayPeriod') {
    return dayPeriodText(value === 'pm' ? 'pm' : 'am', locale);
  }
  return formatNumber(Number(value), locale, {
    minimumIntegerDigits: unit === 'hour' && hourCycle === 12 ? 1 : 2,
  });
}
