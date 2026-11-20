import { dayPeriodText, formatter } from '../date-time/format';
import {
  isKind,
  toPlainDate,
  toPlainTime,
  withDate,
  withTime,
} from '../date-time/temporal';
import type { DateValue, TemporalValue } from '../date-time/temporal';

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

export type DayPeriod = 'am' | 'pm';
export type NumericSegmentType = Exclude<EditableSegmentType, 'dayPeriod'>;

/**
 * The numbers of the segments as the user reads them. `year` is the year in its era, and `hour` is
 * the hour that the hour cycle shows. A segment that has no number is empty.
 */
export interface SegmentNumbers {
  era?: string | undefined;
  year?: number | undefined;
  month?: number | undefined;
  day?: number | undefined;
  hour?: number | undefined;
  minute?: number | undefined;
  second?: number | undefined;
  dayPeriod?: DayPeriod | undefined;
}

export interface SegmentRange {
  min: number;
  max: number;
}

/** What the year and the month of a date give to the ranges of the month and the day. */
export interface Limits {
  monthsInYear: number;
  daysInMonth: number;
}

export interface NumbersContext {
  calendar: string;
  hourCycle: HourCycle | undefined;
  /** Whether the layout has a date segment, and whether it has a time segment. */
  hasDate: boolean;
  hasTime: boolean;
}

/** The step of Page Up and Page Down. */
export const PAGE_STEPS: Record<NumericSegmentType, number> = {
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  minute: 15,
  second: 15,
};

const MAX_YEAR = 9999;

/** The year in a property bag of `Temporal`: an era year, or the year of a calendar with no eras. */
function yearProperties(era: string | undefined, year: number) {
  return era === undefined ? { year } : { era, eraYear: year };
}

export function isNumericType(type: EditableSegmentType): type is NumericSegmentType {
  return type !== 'dayPeriod';
}

const HOUR_RANGES: Record<HourCycle, SegmentRange> = {
  h11: { min: 0, max: 11 },
  h12: { min: 1, max: 12 },
  h23: { min: 0, max: 23 },
  h24: { min: 1, max: 24 },
};

export function getRange(
  type: NumericSegmentType,
  limits: Limits,
  hourCycle: HourCycle | undefined,
): SegmentRange {
  switch (type) {
    case 'year':
      return { min: 1, max: MAX_YEAR };
    case 'month':
      return { min: 1, max: limits.monthsInYear };
    case 'day':
      return { min: 1, max: limits.daysInMonth };
    case 'hour':
      return HOUR_RANGES[hourCycle ?? 'h23'];
    case 'minute':
    case 'second':
      return { min: 0, max: 59 };
  }
}

/** The number of digits that a number of the segment has at least. */
export function getPadding(
  type: NumericSegmentType,
  hourCycle: HourCycle | undefined,
  forceLeadingZeros: boolean,
): number {
  switch (type) {
    case 'minute':
    case 'second':
      return 2;
    case 'hour':
      return forceLeadingZeros || hourCycle === 'h23' || hourCycle === 'h24' ? 2 : 1;
    case 'month':
    case 'day':
      return forceLeadingZeros ? 2 : 1;
    case 'year':
      return 1;
  }
}

// The hour that the cycle shows, for an hour from 0 to 23.
function toShownHour(hour: number, hourCycle: HourCycle | undefined): number {
  switch (hourCycle) {
    case 'h11':
      return hour % 12;
    case 'h12':
      return hour % 12 || 12;
    case 'h24':
      return hour || 24;
    case 'h23':
    case undefined:
      return hour;
  }
}

function fromShownHour(
  shown: number,
  hourCycle: HourCycle | undefined,
  dayPeriod: DayPeriod,
): number {
  const offset = dayPeriod === 'pm' ? 12 : 0;
  switch (hourCycle) {
    case 'h11':
      return shown + offset;
    case 'h12':
      return (shown % 12) + offset;
    case 'h24':
      return shown % 24;
    case 'h23':
    case undefined:
      return shown;
  }
}

/** The numbers that a value has in a calendar. */
export function toNumbers(
  value: TemporalValue,
  calendar: string,
  hourCycle: HourCycle | undefined,
): SegmentNumbers {
  const numbers: SegmentNumbers = {};
  if (!isKind(value, 'time')) {
    const date = toPlainDate(value).withCalendar(calendar);
    numbers.era = date.era;
    numbers.year = date.eraYear ?? date.year;
    numbers.month = date.month;
    numbers.day = date.day;
  }
  if (!isKind(value, 'date') && !isKind(value, 'yearMonth')) {
    const time = toPlainTime(value);
    numbers.hour = toShownHour(time.hour, hourCycle);
    numbers.minute = time.minute;
    numbers.second = time.second;
    numbers.dayPeriod = time.hour < 12 ? 'am' : 'pm';
  }
  return numbers;
}

function toDate(
  numbers: SegmentNumbers,
  like: DateValue | Temporal.PlainYearMonth,
  calendar: string,
): Temporal.PlainDate {
  const base = toPlainDate(like).withCalendar(calendar);
  const year = numbers.year ?? base.eraYear ?? base.year;
  const era = numbers.era ?? base.era;
  return Temporal.PlainDate.from(
    {
      calendar,
      ...yearProperties(era, year),
      month: numbers.month ?? base.month,
      day: numbers.day ?? (isKind(like, 'yearMonth') ? 1 : base.day),
    },
    { overflow: 'constrain' },
  );
}

/**
 * A value of the kind, the calendar, the time and the zone of `template`, with the numbers that the
 * layout shows. A number that is missing keeps the part of `template`. A day above the length of
 * the month goes down to the last day of that month.
 */
export function fromNumbers<Value extends TemporalValue>(
  numbers: SegmentNumbers,
  template: Value,
  context: NumbersContext,
): Value;
export function fromNumbers(
  numbers: SegmentNumbers,
  template: TemporalValue,
  { calendar, hourCycle, hasDate, hasTime }: NumbersContext,
): TemporalValue {
  let result = template;
  if (hasDate && !isKind(result, 'time')) {
    result = withDate(result, toDate(numbers, result, calendar));
  }
  if (hasTime && !isKind(result, 'date') && !isKind(result, 'yearMonth')) {
    const time = toPlainTime(result);
    const dayPeriod = numbers.dayPeriod ?? (time.hour < 12 ? 'am' : 'pm');
    result = withTime(
      result,
      time.with({
        hour: fromShownHour(
          numbers.hour ?? toShownHour(time.hour, hourCycle),
          hourCycle,
          dayPeriod,
        ),
        minute: numbers.minute ?? time.minute,
        second: numbers.second ?? time.second,
      }),
    );
  }
  return result;
}

/**
 * The months of the year and the days of the month of `numbers`. With no year, the month range is
 * the widest of the calendar: the most months of three years in a row, because a calendar such as
 * the Hebrew one adds a leap month within each three years. With no year or no month, the day
 * range is 1 to 31, so the day is not limited before it is known.
 */
export function getLimits(numbers: SegmentNumbers, calendar: string): Limits {
  const { era, year, month } = numbers;
  if (year === undefined) {
    const first = getSample(calendar).toPlainDate();
    const monthsInYear = Math.max(...[0, 1, 2].map((years) => first.add({ years }).monthsInYear));
    return { monthsInYear, daysInMonth: 31 };
  }
  const yearBag = yearProperties(era, year);
  const monthsInYear = Temporal.PlainYearMonth.from({
    calendar,
    ...yearBag,
    month: 1,
  }).monthsInYear;
  const daysInMonth =
    month === undefined
      ? 31
      : Temporal.PlainYearMonth.from({ calendar, ...yearBag, month }).daysInMonth;
  return { monthsInYear, daysInMonth };
}

/**
 * The era and the year that are `amount` years from the year of `numbers`. The era can change. A
 * year outside the range of the segment keeps the numbers.
 */
export function shiftYear(
  numbers: SegmentNumbers,
  amount: number,
  calendar: string,
): Pick<SegmentNumbers, 'era' | 'year'> {
  const { era, year } = numbers;
  if (year === undefined) {
    return {};
  }
  const first = Temporal.PlainDate.from({
    calendar,
    ...yearProperties(era, year),
    month: 1,
    day: 1,
  });
  const shifted = first.add({ years: amount });
  const shiftedYear = shifted.eraYear ?? shifted.year;
  return shiftedYear < 1 || shiftedYear > MAX_YEAR
    ? { era, year }
    : { era: shifted.era, year: shiftedYear };
}

/** `value` moved into `range`: a number past one end goes on from the other end. */
export function wrapNumber(value: number, { min, max }: SegmentRange): number {
  const size = max - min + 1;
  return ((((value - min) % size) + size) % size) + min;
}

export interface TypedDigit {
  /** The number after the digit, or `undefined` when the digits so far are not a number of the range. */
  number: number | undefined;
  /** The digits that the next digit adds to. It is empty when the segment is full. */
  digits: string;
  /** Whether the focus goes on to the next segment. */
  advance: boolean;
}

/**
 * Adds `digit` to the digits that the user typed in a segment. The segment is full, and the focus
 * goes on, when it has the length of its greatest number or when no next digit gives a number of
 * the range. A digit that makes a number above the range starts the digits again.
 */
export function typeDigit(typed: string, digit: number, range: SegmentRange): TypedDigit {
  const maxLength = String(range.max).length;
  let digits = typed + String(digit);
  if (Number(digits) > range.max) {
    digits = String(digit);
  }
  const number = Number(digits);
  if (number < range.min) {
    return { number: undefined, digits: digits.length >= maxLength ? '' : digits, advance: false };
  }
  const isFull = digits.length >= maxLength || Number(`${digits}0`) > range.max;
  return { number, digits: isFull ? '' : digits, advance: isFull };
}

/** The digit that `character` is in ASCII or in the numbering system `digits`, else `undefined`. */
export function digitOf(character: string, digits: readonly string[]): number | undefined {
  const normalized = character.normalize('NFKC');
  const index = digits.indexOf(normalized);
  if (index !== -1) {
    return index;
  }
  return /^[0-9]$/.test(normalized) ? Number(normalized) : undefined;
}

/**
 * The day period whose text starts with `letter`, or `undefined` when no period or both periods
 * start with it.
 */
export function dayPeriodOfLetter(
  letter: string,
  texts: Record<DayPeriod, string>,
): DayPeriod | undefined {
  const typed = letter.toLowerCase();
  const periods = (['am', 'pm'] as const).filter((period) =>
    texts[period].toLowerCase().startsWith(typed),
  );
  return periods.length === 1 ? periods[0] : undefined;
}

/**
 * The numbers of a text in the layout of a locale, or `undefined` when the text has not exactly
 * one number for each numeric segment, or has no day period where the layout has one.
 */
export function parseLocaleText(
  text: string,
  types: readonly EditableSegmentType[],
  digits: readonly string[],
  dayPeriodTexts: Record<DayPeriod, string>,
): SegmentNumbers | undefined {
  const normalized = Array.from(text, (character) => digitOf(character, digits) ?? character).join(
    '',
  );
  const tokens = normalized.match(/\d+/g) ?? [];
  const numericTypes = types.filter(isNumericType);
  if (tokens.length !== numericTypes.length) {
    return undefined;
  }
  const numbers: SegmentNumbers = {};
  numericTypes.forEach((type, index) => {
    numbers[type] = Number(tokens[index]);
  });
  if (types.includes('dayPeriod')) {
    const lowerText = normalized.toLowerCase();
    numbers.dayPeriod = (['am', 'pm'] as const).find((period) =>
      lowerText.includes(dayPeriodTexts[period].toLowerCase()),
    );
    if (numbers.dayPeriod === undefined) {
      return undefined;
    }
  }
  return numbers;
}
