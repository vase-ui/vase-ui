import { isKind, toPlainDate, toPlainTime, withDate, withTime } from '../temporal';
import type { DateValue, TemporalValue } from '../temporal';
import type { EditableSegmentType, HourCycle } from './segmentLayout';

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

export const PLACEHOLDERS: Record<EditableSegmentType, string> = {
  year: 'yyyy',
  month: 'mm',
  day: 'dd',
  hour: 'hh',
  minute: 'mm',
  second: 'ss',
  dayPeriod: '--',
};

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
 * The months of the year and the days of the month of `numbers`. A year that `numbers` lacks comes
 * from `fallback`. With no year or no month, the month can have 31 days, so the day is not limited
 * before it is known.
 */
export function getLimits(
  numbers: SegmentNumbers,
  fallback: SegmentNumbers,
  calendar: string,
): Limits {
  const { era, year } = numbers.year === undefined ? fallback : numbers;
  if (year === undefined) {
    return { monthsInYear: 12, daysInMonth: 31 };
  }
  const yearBag = yearProperties(era, year);
  const monthsInYear = Temporal.PlainYearMonth.from({
    calendar,
    ...yearBag,
    month: 1,
  }).monthsInYear;
  const daysInMonth =
    numbers.year !== undefined && numbers.month !== undefined
      ? Temporal.PlainYearMonth.from({ calendar, ...yearBag, month: numbers.month }).daysInMonth
      : 31;
  return { monthsInYear, daysInMonth };
}

/** The era and the year that are `amount` years from the year of `numbers`. The era can change. */
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
  return Math.abs(shifted.year) > MAX_YEAR
    ? { era, year }
    : { era: shifted.era, year: shifted.eraYear ?? shifted.year };
}

/** `value` moved into `range`: a number past one end goes on from the other end. */
export function wrapNumber(value: number, { min, max }: SegmentRange): number {
  const size = max - min + 1;
  return ((((value - min) % size) + size) % size) + min;
}

/** The number without its last digit. A number of one digit gives no number. */
export function removeLastDigit(number: number): number | undefined {
  const rest = Math.trunc(number / 10);
  return rest === 0 ? undefined : rest;
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
