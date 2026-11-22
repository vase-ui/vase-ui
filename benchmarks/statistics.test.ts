import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, medianInterval, summaryOf } from './statistics.ts';

/** Samples of 30 rounds: the reference, with a spread of 10 times between rounds. */
const reference = Array.from({ length: 30 }, (_, round) => (round % 2 === 0 ? 10 : 100) + round);

test('the summary has the median, the 90th percentile and an interval around the median', () => {
  const summary = summaryOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(summary.median, 5.5);
  assert.equal(summary.p90, 9.1);
  assert.ok(summary.interval[0] < 5.5 && summary.interval[1] > 5.5, String(summary.interval));
});

test('the same samples give the same interval', () => {
  assert.deepEqual(medianInterval(reference), medianInterval([...reference]));
});

test('a ratio reads slower or faster only when its whole interval is outside the band', () => {
  const slower = compare(
    reference.map((sample) => sample * 1.1),
    reference,
  );
  assert.equal(slower.verdict, 'slower');
  assert.ok(Math.abs(slower.ratio - 1.1) < 1e-9);
  assert.equal(
    compare(
      reference.map((sample) => sample * 0.9),
      reference,
    ).verdict,
    'faster',
  );
  assert.equal(
    compare(
      reference.map((sample) => sample * 1.04),
      reference,
    ).verdict,
    'none',
  );
});

test('a ratio pairs the samples of the same round', () => {
  // The samples of the slower library of the test above, each one in the next round. They spread
  // over the same range as those of the reference, so only the pairs by round show the difference.
  const otherRounds = reference.map((_, round) => (reference[(round + 1) % 30] ?? 0) * 1.1);
  assert.equal(compare(otherRounds, reference).verdict, 'none');
});

test('the interval has the 99% level', () => {
  // The 95% interval of these ratios is 1.056 to 1.107, above the band. The 99% interval is not.
  const ratios = Array.from(
    { length: 30 },
    (_, round) => Math.round((1.08 + 0.05 * Math.sin(round * 2.3)) * 1000) / 1000,
  );
  const comparison = compare(
    ratios,
    ratios.map(() => 1),
  );
  assert.ok(comparison.interval[0] < 1.05, String(comparison.interval));
  assert.equal(comparison.verdict, 'none');
});
