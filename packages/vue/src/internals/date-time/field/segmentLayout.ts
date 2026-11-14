import { formatter } from '../format';
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
  era: boolean;
  timeZoneName: boolean;
}

export interface LayoutSegment {
  type: SegmentType;
  /** The text of a literal. Each other type has no text in a layout. */
  text: string;
}

export interface SegmentLayout {
  hourCycle: HourCycle | undefined;
  segments: LayoutSegment[];
}

function intlOptions({
  date,
  time,
  hourCycle,
  era,
  timeZoneName,
}: SegmentLayoutOptions): Intl.DateTimeFormatOptions {
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

/**
 * The order of the segments and the text of the literals for a locale, from the parts that `Intl`
 * gives for a sample. Two literals in a row are one literal.
 */
export function getSegmentLayout(
  locale: Intl.LocalesArgument,
  options: SegmentLayoutOptions,
): SegmentLayout {
  const [format, epoch] = formatter(getSample(options.calendar), intlOptions(options), locale);
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
  return { hourCycle: options.time ? format.resolvedOptions().hourCycle : undefined, segments };
}

/** The text of the era and of the time zone name of `value`. They are not edited. */
export function getFixedSegmentTexts(
  value: TemporalValue,
  locale: Intl.LocalesArgument,
  options: SegmentLayoutOptions,
): Record<'era' | 'timeZoneName', string> {
  const [format, epoch] = formatter(value, intlOptions(options), locale);
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
  const text = (time: string) => {
    const [format, epoch] = formatter(
      Temporal.PlainTime.from(time),
      { hour: 'numeric', hourCycle: 'h12' },
      locale,
    );
    return format.formatToParts(epoch).find((part) => part.type === 'dayPeriod')?.value ?? '';
  };
  return { am: text('03:00'), pm: text('15:00') };
}
