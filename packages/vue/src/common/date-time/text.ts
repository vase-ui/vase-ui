import { formatter } from './format';
import type { TemporalValue } from './temporal';

/** The text of `value` in `locale`. */
export function formatText(
  value: TemporalValue,
  options: Intl.DateTimeFormatOptions,
  locale: Intl.LocalesArgument,
): string {
  const [format, epochMilliseconds] = formatter(value, options, locale);
  return format.format(epochMilliseconds);
}

/** The text of the two values as a range, such as `November 9 – 15, 2026`. */
export function formatRangeText(
  start: TemporalValue,
  end: TemporalValue,
  options: Intl.DateTimeFormatOptions,
  locale: Intl.LocalesArgument,
): string {
  const [format, from] = formatter(start, options, locale);
  const [, to] = formatter(end, options, locale);
  return format.formatRange(from, to);
}
