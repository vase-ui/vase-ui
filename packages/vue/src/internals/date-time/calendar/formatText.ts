import { formatter } from '../format';
import type { DayOfWeek, TemporalValue } from '../temporal';
import type { CalendarPage } from './monthGrid';

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
const DURATION_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

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

/** The text of a number with the digits of `locale`. */
export function formatNumber(value: number, locale: Intl.LocalesArgument): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * The name of a page: its month, or its first and last day for a page of weeks or days.
 * `format` replaces the default format of that kind of page.
 */
export function formatPage(
  page: CalendarPage,
  locale: Intl.LocalesArgument,
  format?: Intl.DateTimeFormatOptions,
): string {
  return page.isDuration
    ? formatRangeText(page.start, page.end, format ?? DURATION_FORMAT, locale)
    : formatText(page.yearMonth, format ?? MONTH_FORMAT, locale);
}

/** The name of the pages of a calendar: the name of one page, or the first and the last month. */
export function formatPages(pages: readonly CalendarPage[], locale: Intl.LocalesArgument): string {
  const [first] = pages;
  const last = pages.at(-1);
  if (!first || !last || first === last) {
    return first ? formatPage(first, locale) : '';
  }
  return formatRangeText(first.yearMonth, last.yearMonth, MONTH_FORMAT, locale);
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

/** The name of the field of a date that a select sets, such as `month`. */
export function formatFieldName(field: 'month' | 'year', locale: Intl.LocalesArgument): string {
  return new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of(field) ?? field;
}
