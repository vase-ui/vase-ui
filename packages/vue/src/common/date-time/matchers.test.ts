import { describe, expect, it, vi } from 'vitest';
import { matches } from './matchers';
import type { DateMatcher } from './matchers';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday.
describe('matches', () => {
  it.each([
    { name: 'the same day', matcher: () => day('2026-11-14'), day: '2026-11-14', expected: true },
    { name: 'another day', matcher: () => day('2026-11-14'), day: '2026-11-15', expected: false },
    {
      name: 'a date and time on that day',
      matcher: () => Temporal.PlainDateTime.from('2026-11-14T23:59'),
      day: '2026-11-14',
      expected: true,
    },
    {
      name: 'a zoned date and time, by its own day',
      matcher: () => Temporal.ZonedDateTime.from('2026-11-14T00:30[Asia/Tokyo]'),
      day: '2026-11-14',
      expected: true,
    },
    {
      name: 'the same day in another calendar',
      matcher: () => day('2026-11-14').withCalendar('hebrew'),
      day: '2026-11-14',
      expected: true,
    },
  ])('matches a date: $name', ({ matcher, day: text, expected }) => {
    expect(matches(day(text), matcher())).toBe(expected);
  });

  it('compares a day of a Persian calendar with a date of the ISO calendar', () => {
    expect(matches(day('2026-11-14').withCalendar('persian'), day('2026-11-14'))).toBe(true);
    expect(matches(day('2026-11-15').withCalendar('persian'), day('2026-11-14'))).toBe(false);
  });

  const range = { start: day('2026-11-10'), end: day('2026-11-20') };
  it.each([
    { name: 'the start', day: '2026-11-10', expected: true },
    { name: 'the end', day: '2026-11-20', expected: true },
    { name: 'a day between', day: '2026-11-14', expected: true },
    { name: 'a day before the start', day: '2026-11-09', expected: false },
    { name: 'a day after the end', day: '2026-11-21', expected: false },
  ])('matches a range, $name', ({ day: text, expected }) => {
    expect(matches(day(text), range)).toBe(expected);
  });

  it('matches no day for a range that ends before it starts', () => {
    const backward = { start: day('2026-11-20'), end: day('2026-11-10') };
    expect(matches(day('2026-11-14'), backward)).toBe(false);
    expect(matches(day('2026-11-10'), backward)).toBe(false);
    expect(matches(day('2026-11-20'), backward)).toBe(false);
  });

  it.each([
    {
      name: 'the day before',
      matcher: { before: day('2026-11-14') },
      day: '2026-11-13',
      expected: true,
    },
    {
      name: 'the day itself',
      matcher: { before: day('2026-11-14') },
      day: '2026-11-14',
      expected: false,
    },
    {
      name: 'the day after',
      matcher: { before: day('2026-11-14') },
      day: '2026-11-15',
      expected: false,
    },
  ])('matches before a day: $name', ({ matcher, day: text, expected }) => {
    expect(matches(day(text), matcher)).toBe(expected);
  });

  it.each([
    {
      name: 'the day after',
      matcher: { after: day('2026-11-14') },
      day: '2026-11-15',
      expected: true,
    },
    {
      name: 'the day itself',
      matcher: { after: day('2026-11-14') },
      day: '2026-11-14',
      expected: false,
    },
    {
      name: 'the day before',
      matcher: { after: day('2026-11-14') },
      day: '2026-11-13',
      expected: false,
    },
  ])('matches after a day: $name', ({ matcher, day: text, expected }) => {
    expect(matches(day(text), matcher)).toBe(expected);
  });

  const between = { after: day('2026-11-10'), before: day('2026-11-20') };
  it.each([
    { name: 'a day between', day: '2026-11-14', expected: true },
    { name: 'the day that it is after', day: '2026-11-10', expected: false },
    { name: 'the day that it is before', day: '2026-11-20', expected: false },
    { name: 'a day outside', day: '2026-11-25', expected: false },
  ])('matches between two days, $name', ({ day: text, expected }) => {
    expect(matches(day(text), between)).toBe(expected);
  });

  it.each([
    { name: 'one day, on that day', dayOfWeek: 6, day: '2026-11-14', expected: true },
    { name: 'one day, on another day', dayOfWeek: 6, day: '2026-11-15', expected: false },
    { name: 'a list, on its first day', dayOfWeek: [6, 7], day: '2026-11-14', expected: true },
    { name: 'a list, on its last day', dayOfWeek: [6, 7], day: '2026-11-15', expected: true },
    { name: 'a list, on another day', dayOfWeek: [6, 7], day: '2026-11-16', expected: false },
    { name: 'an empty list', dayOfWeek: [], day: '2026-11-14', expected: false },
  ] as const)('matches days of the week: $name', ({ dayOfWeek, day: text, expected }) => {
    expect(matches(day(text), { dayOfWeek })).toBe(expected);
  });

  it('gives the day to a function, and matches what it returns', () => {
    const isFirst = vi.fn((date: Temporal.PlainDate) => date.day === 1);
    expect(matches(day('2026-11-01'), isFirst)).toBe(true);
    expect(matches(day('2026-11-14'), isFirst)).toBe(false);
    expect(isFirst.mock.calls[0]?.[0].toString()).toBe('2026-11-01');
  });

  it.each([
    { name: 'an empty list', matcher: [], expected: false },
    {
      name: 'a list with one match',
      matcher: [day('2026-11-01'), day('2026-11-14')],
      expected: true,
    },
    {
      name: 'a list with no match',
      matcher: [day('2026-11-01'), day('2026-11-02')],
      expected: false,
    },
    {
      name: 'a list of different forms',
      matcher: [day('2026-11-01'), { dayOfWeek: 6 }, (date: Temporal.PlainDate) => date.day === 3],
      expected: true,
    },
    { name: 'a list in a list', matcher: [[], [[{ before: day('2026-11-15') }]]], expected: true },
  ] satisfies { name: string; matcher: DateMatcher; expected: boolean }[])(
    'matches $name',
    ({ matcher, expected }) => {
      expect(matches(day('2026-11-14'), matcher)).toBe(expected);
    },
  );

  it('matches no day for no matcher', () => {
    expect(matches(day('2026-11-14'), undefined)).toBe(false);
  });

  it.each([
    { name: 'a bound that is absent', matcher: { before: undefined }, expected: false },
    {
      name: 'all the bounds absent',
      matcher: { before: undefined, after: undefined },
      expected: false,
    },
    {
      name: 'a range with no end',
      matcher: { start: day('2026-11-10'), end: undefined },
      expected: true,
    },
    {
      name: 'a range with no start',
      matcher: { start: undefined, end: day('2026-11-10') },
      expected: false,
    },
  ])('does not match every day for $name', ({ matcher, expected }) => {
    expect(matches(day('2026-11-14'), matcher as unknown as DateMatcher)).toBe(expected);
  });
});
