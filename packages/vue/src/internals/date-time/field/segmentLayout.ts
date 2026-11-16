import { dayPeriodText, formatter } from '../format';
import { isKind } from '../temporal';
import type { TemporalValue } from '../temporal';

export type EditableSegmentType =
  'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'dayPeriod';
export type SegmentType = EditableSegmentType | 'era' | 'timeZoneName' | 'literal';
export type HourCycle = 'h11' | 'h12' | 'h23' | 'h24';
export type TimeUnit = 'hour' | 'minute' | 'second';

export interface SegmentLayoutOptions {
  /** `month` shows the year and the month, `day` shows the year, the month and the day. */
  date: 'month' | 'day' | undefined;
  /** The last time unit that the layout shows. */
  time: TimeUnit | undefined;
  /** `12` or `24` replaces the hour cycle of the locale. */
  hourCycle: 12 | 24 | undefined;
  calendar: string;
  /** Whether the layout must have an era. `Intl` has an era in its own pattern for some locales. */
  era: boolean;
  timeZoneName: boolean;
}

/**
 * The greatest number of items in a layout, for each family of field. A layout joins two literals
 * in a row, so it has a literal before, between and after the items that are not literals. A date
 * layout has at most ten of these items: the era, the year (a year of the Chinese calendar can have
 * `relatedYear` and `yearName`), the month, the day, the three time units, the day period and the
 * time zone name. A time layout has at most five. The `Input` of a field renders a list of this
 * length.
 */
export const MAX_LAYOUT_LENGTH = { date: 21, time: 11 } as const;

export interface LayoutSegment {
  type: SegmentType;
  /** The text of a literal. Each other type has no text in a layout. */
  text: string;
}

export interface SegmentLayout {
  hourCycle: HourCycle | undefined;
  segments: LayoutSegment[];
  /** The options that gave the layout. The texts of the era and the zone name use them too. */
  formatOptions: Intl.DateTimeFormatOptions;
}

function intlOptions(
  { date, time, hourCycle, timeZoneName }: SegmentLayoutOptions,
  era: boolean,
): Intl.DateTimeFormatOptions {
  const options: Intl.DateTimeFormatOptions = {};
  if (date) {
    options.year = 'numeric';
    options.month = 'numeric';
    options.day = date === 'day' ? 'numeric' : undefined;
    options.era = era ? 'short' : undefined;
  }
  if (time) {
    options.hour = 'numeric';
    options.minute = time === 'hour' ? undefined : '2-digit';
    options.second = time === 'second' ? '2-digit' : undefined;
    options.hourCycle = hourCycle && (hourCycle === 12 ? 'h12' : 'h23');
    options.timeZoneName = timeZoneName ? 'short' : undefined;
  }
  return options;
}

// The sample is a fixed instant, so the layout reads no digit of the value. The padding of an
// engine then does not change it. Only the function reads `Temporal`, and not the module.
function getSample(calendar: string) {
  return Temporal.ZonedDateTime.from('2026-11-14T15:04:05[UTC]').withCalendar(calendar);
}

function toSegmentType(partType: string): SegmentType {
  switch (partType) {
    case 'year':
    case 'relatedYear':
    case 'yearName':
      return 'year';
    case 'era':
    case 'month':
    case 'day':
    case 'hour':
    case 'minute':
    case 'second':
    case 'dayPeriod':
    case 'timeZoneName':
      return partType;
    default:
      return 'literal';
  }
}

function layoutOf(
  format: Intl.DateTimeFormat,
  epoch: number,
  hasTime: boolean,
  formatOptions: Intl.DateTimeFormatOptions,
): SegmentLayout {
  const segments: LayoutSegment[] = [];
  for (const part of format.formatToParts(epoch)) {
    const type = toSegmentType(part.type);
    const previous = segments.at(-1);
    if (type === 'literal' && previous?.type === 'literal') {
      previous.text += part.value;
    } else {
      segments.push({ type, text: type === 'literal' ? part.value : '' });
    }
  }
  return {
    hourCycle: hasTime ? format.resolvedOptions().hourCycle : undefined,
    segments,
    formatOptions,
  };
}

// For some fields and calendars, the pattern of `my`, `ksh` and `sc` has the year of the week
// (`Y`), and `resolvedOptions()` then has no `year`. Before V8 15.5, `formatToParts` ends the
// process for such a pattern (https://github.com/nodejs/node/issues/67076). WebKit gives its year
// as a part of the type `unknown`. The Chinese and Dangi calendars also have no `year`. They give
// `relatedYear`, and the process does not end.
function hasWeekYear(format: Intl.DateTimeFormat, formatOptions: Intl.DateTimeFormatOptions) {
  if (formatOptions.year === undefined) {
    return false;
  }
  const { year, calendar } = format.resolvedOptions();
  return year === undefined && calendar !== 'chinese' && calendar !== 'dangi';
}

// The digits and the separators of a date have no letter, so a letter is the era of the pattern.
function patternHasEra(
  sample: Temporal.ZonedDateTime,
  locale: Intl.LocalesArgument,
  options: SegmentLayoutOptions,
): boolean {
  const dateOptions = intlOptions({ ...options, time: undefined }, false);
  const [format, epoch] = formatter(sample, dateOptions, locale);
  return /\p{L}/u.test(format.format(epoch));
}

function withoutEra(layout: SegmentLayout): SegmentLayout {
  const segments = layout.segments.slice();
  const index = segments.findIndex(({ type }) => type === 'era');
  if (index !== -1) {
    segments.splice(index === 0 ? 0 : index - 1, 2);
  }
  return { ...layout, segments };
}

/**
 * The order of the segments and the text of the literals for a locale, from the parts that `Intl`
 * gives for a sample. Two literals in a row are one literal. `Intl` gets the era only when its
 * pattern for the locale and the calendar has no era. Where the pattern has one, such as the
 * Japanese calendar, the era keeps the style of the pattern in each era.
 *
 * When the pattern has the year of the week (`Y`), the layout comes from the pattern with an era.
 * That pattern has the year of the calendar (`y`). The layout keeps its era only when the field
 * needs one, or when the pattern with no era has one.
 */
export function getSegmentLayout(
  locale: Intl.LocalesArgument,
  options: SegmentLayoutOptions,
): SegmentLayout {
  const hasTime = options.time !== undefined;
  const sample = getSample(options.calendar);
  const layoutWithEra = () => {
    const eraOptions = intlOptions(options, true);
    return layoutOf(...formatter(sample, eraOptions, locale), hasTime, eraOptions);
  };
  const formatOptions = intlOptions(options, false);
  const [format, epoch] = formatter(sample, formatOptions, locale);
  if (hasWeekYear(format, formatOptions)) {
    const layout = layoutWithEra();
    return options.era || patternHasEra(sample, locale, options) ? layout : withoutEra(layout);
  }
  const layout = layoutOf(format, epoch, hasTime, formatOptions);
  const needsEra = options.era && !layout.segments.some(({ type }) => type === 'era');
  return needsEra ? layoutWithEra() : layout;
}

// The calendar of a value gives the era, so the value is in the calendar of the layout. A year and
// month has no `withCalendar`.
function inCalendar(value: TemporalValue, calendar: string): TemporalValue {
  if (isKind(value, 'time')) {
    return value;
  }
  return isKind(value, 'yearMonth')
    ? value.toPlainDate({ day: 1 }).withCalendar(calendar)
    : value.withCalendar(calendar);
}

/** The text of the era and of the time zone name of `value`. They are not edited. */
export function getFixedSegmentTexts(
  value: TemporalValue,
  locale: Intl.LocalesArgument,
  { formatOptions }: SegmentLayout,
  calendar: string,
): Record<'era' | 'timeZoneName', string> {
  const [format, epoch] = formatter(inCalendar(value, calendar), formatOptions, locale);
  const texts = { era: '', timeZoneName: '' };
  for (const part of format.formatToParts(epoch)) {
    if (part.type === 'era' || part.type === 'timeZoneName') {
      texts[part.type] = part.value;
    }
  }
  return texts;
}

/** The text of the two day periods of a locale, such as `AM` and `PM`. */
export function getDayPeriodTexts(locale: Intl.LocalesArgument): Record<'am' | 'pm', string> {
  return { am: dayPeriodText('am', locale), pm: dayPeriodText('pm', locale) };
}
