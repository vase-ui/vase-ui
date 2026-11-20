import { describe, expect, it } from 'vitest';
import { compareMoments, getInputLimits, laterMinimum } from './limits';

const day = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);

describe('getInputLimits', () => {
  it.each([
    { kind: 'date', seconds: false, min: '2026-11-02', max: '2026-11-20' },
    { kind: 'dateTime', seconds: false, min: '2026-11-02T00:00', max: '2026-11-20T23:59' },
    { kind: 'dateTime', seconds: true, min: '2026-11-02T00:00', max: '2026-11-20T23:59:59' },
  ] as const)('gives $min and $max of two days for $kind with seconds $seconds', (row) => {
    expect(getInputLimits(row.kind, day('2026-11-02'), day('2026-11-20'), row.seconds)).toEqual({
      min: row.min,
      max: row.max,
    });
  });

  it.each([
    { seconds: false, min: '09:00', max: '17:30' },
    { seconds: true, min: '09:00:00', max: '17:30:00' },
  ])('gives $min and $max of two times with seconds $seconds', (row) => {
    expect(getInputLimits('time', time('09:00'), time('17:30'), row.seconds)).toEqual({
      min: row.min,
      max: row.max,
    });
  });

  // A limit with a time is a moment, in the wall clock of its own zone.
  it.each([
    { kind: 'date', seconds: false, min: '2026-11-02', max: '2026-11-20' },
    { kind: 'dateTime', seconds: false, min: '2026-11-02T10:15', max: '2026-11-20T17:30' },
    { kind: 'dateTime', seconds: true, min: '2026-11-02T10:15:00', max: '2026-11-20T17:30:00' },
  ] as const)(
    'gives $min and $max for $kind with seconds $seconds and limits with a time',
    (row) => {
      const min = Temporal.PlainDateTime.from('2026-11-02T10:15');
      const max = Temporal.ZonedDateTime.from('2026-11-20T17:30[Asia/Tokyo]');

      expect(getInputLimits(row.kind, min, max, row.seconds)).toEqual({
        min: row.min,
        max: row.max,
      });
    },
  );

  // The step base of a `datetime-local` input is its `min`, and the text of a value has no more than
  // the unit of the input. A least limit thus rounds up to that unit, and a greatest limit down.
  it.each([
    { seconds: false, min: '2026-11-02T10:16', max: '2026-11-20T17:30' },
    { seconds: true, min: '2026-11-02T10:15:31', max: '2026-11-20T17:30:45' },
  ])(
    'rounds the limits of a date and time to the unit of the input, with seconds $seconds',
    (row) => {
      const min = Temporal.PlainDateTime.from('2026-11-02T10:15:30.5');
      const max = Temporal.PlainDateTime.from('2026-11-20T17:30:45.9');

      expect(getInputLimits('dateTime', min, max, row.seconds)).toEqual({
        min: row.min,
        max: row.max,
      });
    },
  );

  it('gives a least limit that is on a whole minute as it is', () => {
    const min = Temporal.PlainDateTime.from('2026-11-02T10:15');

    expect(getInputLimits('dateTime', min, undefined, false).min).toBe('2026-11-02T10:15');
  });

  it('gives no limit for a limit that is not set, and no date limit for a time', () => {
    expect(getInputLimits('date', undefined, undefined, false)).toEqual({
      min: undefined,
      max: undefined,
    });
    expect(getInputLimits('date', time('09:00'), time('17:30'), false)).toEqual({
      min: undefined,
      max: undefined,
    });
  });
});

describe('compareMoments', () => {
  it.each([
    { name: 'a day before', a: '2026-11-09T23:59', b: '2026-11-10T00:00', expected: -1 },
    {
      name: 'a time before on one day',
      a: '2026-11-10T09:00',
      b: '2026-11-10T10:00',
      expected: -1,
    },
    { name: 'the same moment', a: '2026-11-10T10:00', b: '2026-11-10T10:00', expected: 0 },
    { name: 'a time after on one day', a: '2026-11-10T10:01', b: '2026-11-10T10:00', expected: 1 },
  ])('gives $expected for $name', ({ a, b, expected }) => {
    expect(
      Math.sign(compareMoments(Temporal.PlainDateTime.from(a), Temporal.PlainDateTime.from(b))),
    ).toBe(expected);
  });

  it('counts a date as the start of its day, and a zoned value by its wall clock against a date and time', () => {
    expect(compareMoments(day('2026-11-10'), Temporal.PlainDateTime.from('2026-11-10T00:00'))).toBe(
      0,
    );
    expect(
      compareMoments(
        Temporal.ZonedDateTime.from('2026-11-10T10:00[Asia/Tokyo]'),
        Temporal.PlainDateTime.from('2026-11-10T10:00'),
      ),
    ).toBe(0);
  });

  // 10:00 in Tokyo is 01:00 UTC, and 10:00 in New York on 10 November is 15:00 UTC.
  it.each([
    { name: 'a moment that is before', b: '2026-11-10T10:00[America/New_York]', expected: -1 },
    { name: 'the same moment', b: '2026-11-09T20:00[America/New_York]', expected: 0 },
    { name: 'a moment that is after', b: '2026-11-09T19:00[America/New_York]', expected: 1 },
  ])('compares two zoned values by the moment: $name', ({ b, expected }) => {
    const tokyo = Temporal.ZonedDateTime.from('2026-11-10T10:00[Asia/Tokyo]');

    expect(Math.sign(compareMoments(tokyo, Temporal.ZonedDateTime.from(b)))).toBe(expected);
  });
});

describe('laterMinimum', () => {
  const at = (text: string) => Temporal.PlainDateTime.from(text);

  it.each([
    {
      name: 'no first minimum',
      a: undefined,
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    { name: 'no second minimum', a: '2026-11-10', b: null, expected: '2026-11-10' },
    {
      name: 'a later time of one day',
      a: '2026-11-10T08:00',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    {
      name: 'an earlier time of one day',
      a: '2026-11-10T10:00',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T10:00:00',
    },
    {
      name: 'a date that is the start of the same day',
      a: '2026-11-10',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    { name: 'a later date', a: '2026-11-12', b: '2026-11-10T17:00', expected: '2026-11-12' },
  ])('gives the later of two minimums with $name', ({ a, b, expected }) => {
    const parse = (text: string | null | undefined) =>
      text == null ? undefined : text.includes('T') ? at(text) : day(text);

    expect(laterMinimum(parse(a), parse(b))?.toString()).toBe(expected);
  });
});
