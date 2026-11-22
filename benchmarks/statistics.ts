/** The level of each interval. It is the same for each comparison, so a page of many cells has few verdicts by chance. */
export const LEVEL = 0.99;
/** A ratio reads faster or slower only when its whole interval is outside this band. */
export const BAND = { low: 0.95, high: 1.05 } as const;
/** An end point of a 99% interval rests on the 50 resamples outside it. */
const RESAMPLES = 10_000;
const SEED = 0x9e3779b9;

/**
 * The quantile `q` of samples in ascending order, by linear interpolation between the two nearest
 * ranks. This is the default method of NumPy and of R.
 */
function quantileOfSorted(sorted: ArrayLike<number>, q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = sorted[Math.floor(position)] ?? Number.NaN;
  const upper = sorted[Math.ceil(position)] ?? Number.NaN;
  return lower + (upper - lower) * (position - Math.floor(position));
}

export function quantile(samples: readonly number[], q: number): number {
  return quantileOfSorted(Float64Array.from(samples).sort(), q);
}

export function median(samples: readonly number[]): number {
  return quantile(samples, 0.5);
}

/** mulberry32: numbers in [0, 1) from a fixed seed, so the same samples give the same intervals. */
function randomNumbers(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** The percentile bootstrap interval of the median, at the level `LEVEL`. */
export function medianInterval(samples: readonly number[]): [low: number, high: number] {
  const random = randomNumbers(SEED);
  const resample = new Float64Array(samples.length);
  const medians = new Float64Array(RESAMPLES);
  for (let index = 0; index < RESAMPLES; index++) {
    for (let item = 0; item < resample.length; item++) {
      resample[item] = samples[Math.floor(random() * samples.length)] ?? Number.NaN;
    }
    medians[index] = quantileOfSorted(resample.sort(), 0.5);
  }
  medians.sort();
  const tail = (1 - LEVEL) / 2;
  return [quantileOfSorted(medians, tail), quantileOfSorted(medians, 1 - tail)];
}

export interface Summary {
  median: number;
  p90: number;
  /** The interval of the median. */
  interval: [low: number, high: number];
}

export function summaryOf(samples: readonly number[]): Summary {
  return {
    median: median(samples),
    p90: quantile(samples, 0.9),
    interval: medianInterval(samples),
  };
}

/** `slower`: the library takes more time or memory than the reference. */
export type Verdict = 'faster' | 'slower' | 'none';

export interface Comparison {
  /** The median of the ratios of the library to the reference, one ratio for each round. */
  ratio: number;
  interval: [low: number, high: number];
  verdict: Verdict;
}

/**
 * Compares the samples of a library with those of the reference. Sample `i` of each comes from
 * round `i`, so the noise of the machine in a round reaches both sides of its ratio.
 */
export function compare(samples: readonly number[], reference: readonly number[]): Comparison {
  const ratios = samples.flatMap((sample, round) => {
    const base = reference[round];
    return base === undefined || base === 0 ? [] : [sample / base];
  });
  const interval = medianInterval(ratios);
  const verdict = interval[0] > BAND.high ? 'slower' : interval[1] < BAND.low ? 'faster' : 'none';
  return { ratio: median(ratios), interval, verdict };
}
