import { describe, expect, it, vi } from 'vitest';
import {
  angleOfFaceNumber,
  clampTime,
  dayPeriodOf,
  edgeValue,
  faceNumberOf,
  faceNumberOfPoint,
  faceNumbers,
  gridOf,
  hourCycleOf,
  isTimeAllowed,
  nextView,
  pagePlaces,
  radiusOfFaceNumber,
  stepOf,
  stepValue,
  timeOfDayPeriod,
  timeOfFaceNumber,
  viewsOf,
} from './clockViews';
import type { TimeLimits } from './clockViews';

const time = (text: string) => Temporal.PlainTime.from(text);
const always = () => true;
const noLimits: TimeLimits = { minTime: undefined, maxTime: undefined, disabledTimes: undefined };

describe('views', () => {
  it.each([
    { granularity: 'hour', views: ['hour'] },
    { granularity: 'minute', views: ['hour', 'minute'] },
    { granularity: 'second', views: ['hour', 'minute', 'second'] },
  ] as const)('shows $views for the granularity $granularity', ({ granularity, views }) => {
    expect(viewsOf(granularity)).toEqual(views);
  });

  it.each([
    { name: 'the next view', view: 'hour', granularity: 'second', next: 'minute' },
    { name: 'no view after the last one', view: 'minute', granularity: 'minute', next: undefined },
    {
      name: 'no view after a view past the end',
      view: 'second',
      granularity: 'hour',
      next: undefined,
    },
  ] as const)('gives $name', ({ view, granularity, next }) => {
    expect(nextView(view, granularity)).toBe(next);
  });
});

describe('hourCycleOf', () => {
  it.each([
    { locale: 'en-US', hourCycle: 12 },
    { locale: 'de-DE', hourCycle: 24 },
    { locale: 'en-GB', hourCycle: 24 },
  ] as const)('is $hourCycle for $locale', ({ locale, hourCycle }) => {
    expect(hourCycleOf(locale)).toBe(hourCycle);
  });
});

describe('stepOf', () => {
  it.each([
    { name: 'a minute step', view: 'minute', minuteStep: 5, secondStep: 15, step: 5 },
    { name: 'a second step', view: 'second', minuteStep: 5, secondStep: 15, step: 15 },
    { name: 'a step of 1 for an hour', view: 'hour', minuteStep: 5, secondStep: 15, step: 1 },
    { name: 'a step of 1 for a step of 0', view: 'minute', minuteStep: 0, secondStep: 15, step: 1 },
    {
      name: 'a step of 1 for a fraction',
      view: 'minute',
      minuteStep: 2.5,
      secondStep: 15,
      step: 1,
    },
    { name: 'a step of 1 for NaN', view: 'second', minuteStep: 5, secondStep: Number.NaN, step: 1 },
  ] as const)('gives $name', ({ view, minuteStep, secondStep, step }) => {
    expect(stepOf(view, minuteStep, secondStep)).toBe(step);
  });
});

describe('face numbers', () => {
  it('lists 12 hours from the top of a 12-hour face', () => {
    expect(faceNumbers('hour', 12)).toEqual(
      [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((value) => ({ value, inner: false })),
    );
  });

  it('lists the outer ring and then the inner ring of a 24-hour face', () => {
    const numbers = faceNumbers('hour', 24);
    expect(numbers).toHaveLength(24);
    expect(numbers.slice(0, 12).map(({ value }) => value)).toEqual([
      12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(numbers.slice(12).map(({ value }) => value)).toEqual([
      0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ]);
    expect(numbers.map(({ inner }) => inner)).toEqual([
      ...Array.from({ length: 12 }, () => false),
      ...Array.from({ length: 12 }, () => true),
    ]);
  });

  it.each(['minute', 'second'] as const)('lists a mark for each 5 of the %s view', (view) => {
    expect(faceNumbers(view, 24).map(({ value }) => value)).toEqual([
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
    ]);
  });

  it.each([
    { name: 'noon', view: 'hour', cycle: 12, at: '12:15', number: { value: 12, inner: false } },
    { name: 'midnight', view: 'hour', cycle: 12, at: '00:15', number: { value: 12, inner: false } },
    {
      name: 'the afternoon',
      view: 'hour',
      cycle: 12,
      at: '15:00',
      number: { value: 3, inner: false },
    },
    {
      name: 'noon of 24',
      view: 'hour',
      cycle: 24,
      at: '12:00',
      number: { value: 12, inner: false },
    },
    {
      name: 'midnight of 24',
      view: 'hour',
      cycle: 24,
      at: '00:00',
      number: { value: 0, inner: true },
    },
    {
      name: 'the afternoon of 24',
      view: 'hour',
      cycle: 24,
      at: '13:00',
      number: { value: 13, inner: true },
    },
    {
      name: 'a minute',
      view: 'minute',
      cycle: 12,
      at: '10:37:21',
      number: { value: 37, inner: false },
    },
    {
      name: 'a second',
      view: 'second',
      cycle: 24,
      at: '10:37:21',
      number: { value: 21, inner: false },
    },
  ] as const)('gives the number of $name', ({ view, cycle, at, number }) => {
    expect(faceNumberOf(view, cycle, time(at))).toEqual(number);
  });

  it.each([
    {
      name: 'an hour in the afternoon',
      view: 'hour',
      cycle: 12,
      at: '15:20',
      value: 5,
      result: '17:20',
    },
    {
      name: 'noon in the afternoon',
      view: 'hour',
      cycle: 12,
      at: '15:20',
      value: 12,
      result: '12:20',
    },
    {
      name: 'noon in the morning',
      view: 'hour',
      cycle: 12,
      at: '09:20',
      value: 12,
      result: '00:20',
    },
    { name: 'an hour of 24', view: 'hour', cycle: 24, at: '09:20', value: 13, result: '13:20' },
    { name: 'a minute', view: 'minute', cycle: 12, at: '09:20:45', value: 5, result: '09:05:45' },
    { name: 'a second', view: 'second', cycle: 12, at: '09:20:45', value: 10, result: '09:20:10' },
  ] as const)('sets $name and keeps the other units', ({ view, cycle, at, value, result }) => {
    expect(timeOfFaceNumber(view, cycle, time(at), { value, inner: false }).toString()).toBe(
      time(result).toString(),
    );
  });
});

describe('day period', () => {
  it.each([
    { at: '00:00', period: 'am' },
    { at: '11:59', period: 'am' },
    { at: '12:00', period: 'pm' },
    { at: '23:59', period: 'pm' },
  ] as const)('is $period at $at', ({ at, period }) => {
    expect(dayPeriodOf(time(at))).toBe(period);
  });

  it.each([
    { at: '09:20', period: 'pm', result: '21:20' },
    { at: '21:20', period: 'am', result: '09:20' },
    { at: '00:05', period: 'pm', result: '12:05' },
    { at: '12:05', period: 'am', result: '00:05' },
  ] as const)('moves $at to $period', ({ at, period, result }) => {
    expect(timeOfDayPeriod(time(at), period).toString()).toBe(time(result).toString());
  });
});

describe('placement', () => {
  it.each([
    { view: 'hour', number: { value: 12, inner: false }, angle: 0, radius: 1 },
    { view: 'hour', number: { value: 3, inner: false }, angle: 90, radius: 1 },
    { view: 'hour', number: { value: 13, inner: true }, angle: 30, radius: 0.64 },
    { view: 'hour', number: { value: 0, inner: true }, angle: 0, radius: 0.64 },
    { view: 'minute', number: { value: 15, inner: false }, angle: 90, radius: 1 },
    { view: 'second', number: { value: 55, inner: false }, angle: 330, radius: 1 },
  ] as const)(
    'puts $number.value of $view at $angle degrees',
    ({ view, number, angle, radius }) => {
      expect(angleOfFaceNumber(view, number)).toBe(angle);
      expect(radiusOfFaceNumber(number)).toBe(radius);
    },
  );
});

describe('faceNumberOfPoint', () => {
  it.each([
    { name: 'an hour of a 12-hour face', cycle: 12, angle: 91, ratio: 0.3, value: 3, inner: false },
    { name: 'noon at the top', cycle: 12, angle: 359, ratio: 0.9, value: 12, inner: false },
    { name: 'the outer ring', cycle: 24, angle: 91, ratio: 0.9, value: 3, inner: false },
    {
      name: 'the edge of the outer ring',
      cycle: 24,
      angle: 91,
      ratio: 0.82,
      value: 3,
      inner: false,
    },
    { name: 'the inner ring', cycle: 24, angle: 91, ratio: 0.81, value: 15, inner: true },
    { name: 'midnight on the inner ring', cycle: 24, angle: 2, ratio: 0.3, value: 0, inner: true },
    { name: 'noon on the outer ring', cycle: 24, angle: 2, ratio: 0.9, value: 12, inner: false },
  ] as const)('selects $name', ({ cycle, angle, ratio, value, inner }) => {
    expect(faceNumberOfPoint('hour', cycle, 1, angle, ratio)).toEqual({ value, inner });
  });

  it('selects a minute that is rounded to the step, at any distance', () => {
    expect(faceNumberOfPoint('minute', 24, 5, 37, 0.3)).toEqual({ value: 5, inner: false });
    expect(faceNumberOfPoint('second', 12, 1, 359, 0.3)).toEqual({ value: 0, inner: false });
  });
});

describe('stepping', () => {
  const hours = gridOf('hour', 12, 1);
  const fives = gridOf('minute', 12, 5);

  it.each([
    { name: 'goes forward', grid: hours, value: 5, places: 1, result: 6 },
    { name: 'wraps forward', grid: hours, value: 12, places: 1, result: 1 },
    { name: 'wraps back', grid: hours, value: 1, places: -1, result: 12 },
    { name: 'goes several places', grid: hours, value: 11, places: 2, result: 1 },
    { name: 'goes a step of 5', grid: fives, value: 30, places: 1, result: 35 },
    { name: 'goes to the next step', grid: fives, value: 7, places: 1, result: 10 },
    { name: 'goes to the step before', grid: fives, value: 7, places: -1, result: 5 },
    { name: 'wraps at 60', grid: fives, value: 55, places: 1, result: 0 },
    { name: 'wraps at 0', grid: fives, value: 0, places: -1, result: 55 },
  ])('$name', ({ grid, value, places, result }) => {
    expect(stepValue(grid, value, places, always)).toBe(result);
  });

  it('skips a value that is not enabled', () => {
    expect(stepValue(hours, 5, 1, (value) => value !== 6 && value !== 7)).toBe(8);
    expect(stepValue(hours, 5, -1, (value) => value !== 4)).toBe(3);
  });

  it('gives no value when none is enabled', () => {
    expect(stepValue(hours, 5, 1, () => false)).toBeNull();
    expect(edgeValue(hours, 'first', () => false)).toBeNull();
  });

  it('gives the first and the last enabled value', () => {
    expect(edgeValue(hours, 'first', always)).toBe(1);
    expect(edgeValue(hours, 'last', always)).toBe(12);
    expect(edgeValue(hours, 'first', (value) => value > 3)).toBe(4);
    expect(edgeValue(hours, 'last', (value) => value < 10)).toBe(9);
    expect(edgeValue(gridOf('hour', 24, 1), 'first', always)).toBe(0);
    expect(edgeValue(gridOf('hour', 24, 1), 'last', always)).toBe(23);
  });

  it.each([
    { view: 'hour', step: 1, places: 2 },
    { view: 'minute', step: 1, places: 15 },
    { view: 'minute', step: 5, places: 3 },
    { view: 'second', step: 20, places: 1 },
  ] as const)(
    'goes $places places for a page of $view with a step of $step',
    ({ view, step, places }) => {
      expect(pagePlaces(view, step)).toBe(places);
    },
  );
});

describe('isTimeAllowed', () => {
  const limits = (minTime: string | null, maxTime: string | null): TimeLimits => ({
    minTime: minTime === null ? undefined : time(minTime),
    maxTime: maxTime === null ? undefined : time(maxTime),
    disabledTimes: undefined,
  });

  it.each([
    {
      name: 'an hour that holds the least time',
      view: 'hour',
      at: '09:05',
      min: '09:30',
      max: null,
      allowed: true,
    },
    {
      name: 'an hour before the least time',
      view: 'hour',
      at: '08:59',
      min: '09:30',
      max: null,
      allowed: false,
    },
    {
      name: 'an hour that holds the greatest time',
      view: 'hour',
      at: '17:59',
      min: null,
      max: '17:00',
      allowed: true,
    },
    {
      name: 'an hour after the greatest time',
      view: 'hour',
      at: '18:00',
      min: null,
      max: '17:00',
      allowed: false,
    },
    {
      name: 'a minute that holds the least time',
      view: 'minute',
      at: '09:30:05',
      min: '09:30:30',
      max: null,
      allowed: true,
    },
    {
      name: 'a minute before the least time',
      view: 'minute',
      at: '09:29:59',
      min: '09:30:30',
      max: null,
      allowed: false,
    },
    {
      name: 'a second at the greatest time',
      view: 'second',
      at: '09:30:30',
      min: null,
      max: '09:30:30',
      allowed: true,
    },
    {
      name: 'a second after the greatest time',
      view: 'second',
      at: '09:30:31',
      min: null,
      max: '09:30:30',
      allowed: false,
    },
    {
      name: 'the last hour of the day',
      view: 'hour',
      at: '23:30',
      min: '23:45',
      max: null,
      allowed: true,
    },
  ] as const)('says $allowed for $name', ({ view, at, min, max, allowed }) => {
    expect(isTimeAllowed(time(at), view, limits(min, max))).toBe(allowed);
  });

  it('asks disabledTimes with the time and the view', () => {
    const disabledTimes = vi.fn((candidate: Temporal.PlainTime) => candidate.hour === 4);

    expect(isTimeAllowed(time('04:10'), 'hour', { ...noLimits, disabledTimes })).toBe(false);
    expect(isTimeAllowed(time('05:10'), 'minute', { ...noLimits, disabledTimes })).toBe(true);
    expect(
      disabledTimes.mock.calls.map(([candidate, view]) => [candidate.toString(), view]),
    ).toEqual([
      ['04:10:00', 'hour'],
      ['05:10:00', 'minute'],
    ]);
  });

  it('puts a time into the range', () => {
    const range = limits('09:30', '17:00');
    expect(clampTime(time('09:15'), range).toString()).toBe('09:30:00');
    expect(clampTime(time('17:20'), range).toString()).toBe('17:00:00');
    expect(clampTime(time('12:00'), range).toString()).toBe('12:00:00');
    expect(clampTime(time('03:00'), noLimits).toString()).toBe('03:00:00');
  });
});
