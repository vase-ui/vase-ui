import { isKind, toInputText, toPlainDate } from '../../internals/date-time/temporal';
import type { DateValue, TemporalKind } from '../../internals/date-time/temporal';

/** A failure that a field finds itself, with the flag of `ValidityState` that a `Field` shows. */
export interface DateTimeFieldError {
  flag: 'badInput' | 'rangeUnderflow' | 'rangeOverflow' | 'stepMismatch' | 'customError';
  message: string;
}

/** The wall clock of a value. A date is the start of its day. */
function toWallClock(value: DateValue): Temporal.PlainDateTime {
  return isKind(value, 'dateTime') ? value : value.toPlainDateTime();
}

/**
 * Negative, 0 or positive. Two zoned values compare by the moment, also when their time zones
 * differ. Else the values compare by their wall clocks, and a date is the start of its day.
 */
export function compareMoments(a: DateValue, b: DateValue): number {
  if (isKind(a, 'zonedDateTime') && isKind(b, 'zonedDateTime')) {
    return Temporal.ZonedDateTime.compare(a, b);
  }
  return Temporal.PlainDateTime.compare(toWallClock(a), toWallClock(b));
}

/** The later of two minimums. It is `a` when `b` is absent or not later. */
export function laterMinimum(
  a: DateValue | undefined,
  b: DateValue | null | undefined,
): DateValue | undefined {
  return b != null && (a === undefined || compareMoments(b, a) > 0) ? b : a;
}

/**
 * The `min` and `max` of a native input of `kind`, as text. A limit that is a date limits whole
 * days, so a date and time gets the first and the last moment of that day. A limit with a time
 * gives that time in the unit of the input: a minute, or a second with `showSeconds`. The step base
 * of the input is its `min`, so a least limit rounds up, and a greatest limit rounds down.
 */
export function getInputLimits(
  kind: TemporalKind,
  min: DateValue | Temporal.PlainTime | undefined,
  max: DateValue | Temporal.PlainTime | undefined,
  showSeconds: boolean,
): { min: string | undefined; max: string | undefined } {
  if (kind === 'time') {
    return {
      min: isKind(min, 'time') ? toInputText(min, showSeconds) : undefined,
      max: isKind(max, 'time') ? toInputText(max, showSeconds) : undefined,
    };
  }
  const least = isKind(min, 'time') ? undefined : min;
  const greatest = isKind(max, 'time') ? undefined : max;
  const day = (date: DateValue) => toInputText(toPlainDate(date), false);
  if (kind === 'date') {
    return { min: least && day(least), max: greatest && day(greatest) };
  }
  const smallestUnit = showSeconds ? 'second' : 'minute';
  return {
    min:
      least &&
      (isKind(least, 'date')
        ? `${day(least)}T00:00`
        : toInputText(toWallClock(least).round({ smallestUnit, roundingMode: 'ceil' }), showSeconds)),
    // The text of a moment has no unit below `smallestUnit`, so it rounds down.
    max:
      greatest &&
      (isKind(greatest, 'date')
        ? `${day(greatest)}T23:59${showSeconds ? ':59' : ''}`
        : toInputText(toWallClock(greatest), showSeconds)),
  };
}

/**
 * The failure of a native input that is not in the document, with these attributes, or `null`. The
 * browser gives the message in its own language.
 */
export function nativeFailure(
  document: Document,
  attributes: Record<string, string | undefined>,
): DateTimeFieldError | null {
  const { value = '', ...rest } = attributes;
  const input = document.createElement('input');
  for (const [name, attribute] of Object.entries(rest)) {
    if (attribute !== undefined) input.setAttribute(name, attribute);
  }
  // A `value` attribute would be the step base of an input with no `min`.
  input.value = value;
  const { validity } = input;
  if (validity.valid) return null;
  const flags = ['rangeUnderflow', 'rangeOverflow', 'stepMismatch'] as const;
  return {
    flag: flags.find((flag) => validity[flag]) ?? 'customError',
    message: input.validationMessage,
  };
}
