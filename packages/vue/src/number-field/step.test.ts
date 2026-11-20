import { describe, expect, it } from 'vitest';
import { createNumberText } from './text';
import { roundInRange, stepValue, type Step, type StepLimits } from './step';

const keep = (value: number) => value;

/** One step from `from`, with the limits of a field with no range, no snap and no format. */
function step(from: number, change: Partial<Step>, limits: Partial<StepLimits> = {}) {
  return stepValue(
    from,
    { direction: 1, amount: 1, count: 1, small: false, ...change },
    { snap: false, min: undefined, max: undefined, round: keep, ...limits },
  );
}

describe('a step', () => {
  it.each([
    ['adds its amount', 1.3, {}, {}, 2.3],
    ['subtracts it down', 1.3, { direction: -1 }, {}, 0.3],
    ['adds the amount for each count', 1, { amount: 0.5, count: 3 }, {}, 2.5],
    ['goes into the range at max', 9.5, {}, { max: 10 }, 10],
    ['goes into the range at min', 2, { direction: -1, amount: 5 }, { min: 0 }, 0],
    ['moves a value above max to max', 15, {}, { max: 10 }, 10],
    ['gives the value at its bound', 10, {}, { max: 10 }, 10],
  ] as [string, number, Partial<Step>, Partial<StepLimits>, number][])(
    '%s',
    (_name, from, change, limits, expected) => {
      expect(step(from, change, limits)).toBe(expected);
    },
  );
});

describe('the binary noise of a step', () => {
  it.each([
    ['0.2 + 0.1', 0.2, 0.1, 0.3],
    ['-0.1 - 0.2', -0.1, -0.2, -0.3],
    ['0.7 + 0.1', 0.7, 0.1, 0.8],
    ['0.1 + 0.2 + 0.3', 0.1 + 0.2, 0.3, 0.6],
    ['0.0004 + 0.0001', 0.0004, 0.0001, 0.0005],
    ['1.23456 + 1', 1.23456, 1, 2.23456],
    ['a safe integer', Number.MAX_SAFE_INTEGER - 1, 1, Number.MAX_SAFE_INTEGER],
  ])('removes the noise of %s', (_name, from, amount, expected) => {
    const direction = amount < 0 ? -1 : 1;
    expect(step(from, { direction, amount: Math.abs(amount) })).toBe(expected);
  });

  it('leaves large-magnitude noise uncleaned once one ULP exceeds the absolute cap', () => {
    expect(step(1000000.1, { amount: 0.2 })).toBe(1000000.1 + 0.2);
  });

  it('preserves large fractional values when stepping cleanup would be too coarse', () => {
    expect(step(100000000000000.1, { amount: 0.1 })).toBe(100000000000000.1 + 0.1);
  });

  it('preserves high-significance step values', () => {
    expect(step(0, { amount: 0.1234567890123456 })).toBe(0.1234567890123456);
  });
});

describe('snapOnStep', () => {
  const snap = { snap: true };

  it.each([
    ['5 on a step of 1', 4, {}, {}, 5],
    ['5.5 down to 5 on a step up', 4.5, {}, {}, 5],
    ['-0.3 down to -1 on a step up', -1.3, {}, {}, -1],
    ['9 down to 5 on a step of 5 up', 4, { amount: 5 }, {}, 5],
    ['12 down to 10 on a step of 5 up', 7, { amount: 5 }, {}, 10],
    ['5.5 up to 6 on a step down', 6.5, { direction: -1 }, {}, 6],
    ['-0.3 up to 0 on a step down', 0.7, { direction: -1 }, {}, 0],
    ['9 up to 10 on a step of 5 down', 14, { direction: -1, amount: 5 }, {}, 10],
    ['12 up to 15 on a step of 5 down', 17, { direction: -1, amount: 5 }, {}, 15],
    ['100.1 + 0.1 to 100.2', 100.1, { amount: 0.1 }, {}, 100.2],
    ['100.1 - 0.1 to 100', 100.1, { direction: -1, amount: 0.1 }, {}, 100],
    ['0.01 + 0.01 to 0.02', 0.01, { amount: 0.01 }, {}, 0.02],
    ['3.2 + 0.2 to 3.4 from min 3', 3.2, { amount: 0.2 }, { min: 3 }, 3.4],
    ['a small step to the nearest', 0.05, { amount: 0.1, small: true }, {}, 0.2],
    ['a small step down to the nearest', -0.05, { direction: -1, amount: 0.1, small: true }, {}, -0.2],
    ['13 to a max of 10', 10, { amount: 3 }, { min: 0, max: 10 }, 10],
    ['-13 to a min of -10', -10, { direction: -1, amount: 3 }, { min: -10, max: 0 }, -10],
  ] as [string, number, Partial<Step>, Partial<StepLimits>, number][])(
    'snaps %s',
    (_name, from, change, limits, expected) => {
      expect(step(from, change, { ...snap, ...limits })).toBe(expected);
    },
  );

  it('preserves the exact value with no snap', () => {
    expect(step(4.7, { amount: 5 })).toBe(9.7);
    expect(step(17.3, { direction: -1, amount: 5 })).toBe(12.3);
  });
});

describe('the rounding of the format', () => {
  const round = (format: Intl.NumberFormatOptions) => createNumberText('en-US', format).round;

  it('applies roundingMode after the snap', () => {
    const floor = round({ maximumFractionDigits: 2, roundingMode: 'floor' });
    expect(step(1.238, { amount: 0.001 }, { snap: true, round: floor })).toBe(1.23);
  });

  it('clamps the final value after percent rounding crosses max', () => {
    const percent = round({ style: 'percent', maximumFractionDigits: 2 });
    expect(roundInRange(0.01236, { min: undefined, max: 0.01235, round: percent })).toBe(0.01235);
  });

  it('clamps the final value after directional percent rounding crosses min', () => {
    const percent = round({ style: 'percent', maximumFractionDigits: 2, roundingMode: 'floor' });
    expect(roundInRange(0.01234, { min: 0.01235, max: undefined, round: percent })).toBe(0.01235);
  });

  it('clamps before rounding for non-integer bounds', () => {
    // 0.4 goes to min 0.6 first, and the format shows that as 1. A rounding first would give 0.
    const integer = round({ maximumFractionDigits: 0 });
    expect(roundInRange(0.4, { min: 0.6, max: 10, round: integer })).toBe(1);
  });

  it('keeps rounded out-of-range values when clamping is disabled', () => {
    const twoDigits = round({ maximumFractionDigits: 2 });
    expect(roundInRange(12.349, { min: undefined, max: undefined, round: twoDigits })).toBe(12.35);
  });
});
