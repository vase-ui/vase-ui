import { formatter } from '../format';
import type { DayOfWeek, TemporalValue } from '../temporal';

/** The text of `value` in `locale`. */
export function formatText(
  value: TemporalValue,
  options: Intl.DateTimeFormatOptions,
  locale: Intl.LocalesArgument,
): string {
  const [format, epochMilliseconds] = formatter(value, options, locale);
  return format.format(epochMilliseconds);
}

/** The name of a day of the week. The day 2024-01-01 is a Monday. */
export function formatWeekday(
  weekday: DayOfWeek,
  style: NonNullable<Intl.DateTimeFormatOptions['weekday']>,
  locale: Intl.LocalesArgument,
): string {
  const day = Temporal.PlainDate.from('2024-01-01').add({ days: weekday - 1 });
  return formatText(day, { weekday: style }, locale);
}
