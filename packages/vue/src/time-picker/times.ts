/** The distance between two times of a list, in minutes. */
export const DEFAULT_LIST_STEP = 30;

/** A step must be a whole number of minutes above 0, or the times of a list have no distance. */
export function isValidListStep(step: number): boolean {
  return Number.isInteger(step) && step > 0;
}

/**
 * The times of a list: `minTime`, then each time `step` minutes after the time before it, up to
 * `maxTime`. The limits are the texts of times. With no `minTime`, the list starts at midnight.
 * With no `maxTime`, it ends at the last time of the day.
 */
export function listTimes(
  step: number,
  minTime: string | undefined,
  maxTime: string | undefined,
): Temporal.PlainTime[] {
  const times: Temporal.PlainTime[] = [];
  const last = maxTime === undefined ? undefined : Temporal.PlainTime.from(maxTime);
  let time = minTime === undefined ? new Temporal.PlainTime() : Temporal.PlainTime.from(minTime);
  while (!last || Temporal.PlainTime.compare(time, last) <= 0) {
    times.push(time);
    const next = time.add({ minutes: step });
    // `add` goes round at midnight, so a time that is not later than the time before it ends the day.
    if (Temporal.PlainTime.compare(next, time) <= 0) {
      break;
    }
    time = next;
  }
  return times;
}

/** The `hourCycle` option of `Intl.DateTimeFormat` for an hour cycle prop, or none for the locale. */
export function hourCycleOption(hourCycle: 12 | 24 | undefined): 'h12' | 'h23' | undefined {
  return hourCycle === undefined ? undefined : hourCycle === 12 ? 'h12' : 'h23';
}
