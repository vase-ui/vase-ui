/** The distance between two times of a list, in minutes. */
export const DEFAULT_LIST_STEP = 30;

/** A step must be a whole number of minutes above 0, or the times of a list have no distance. */
export function isValidListStep(step: number): boolean {
  return Number.isInteger(step) && step > 0;
}

/**
 * The times of a list: `minTime`, then each time `step` minutes after the time before it, up to
 * `maxTime`. With no `minTime`, the list starts at midnight. With no `maxTime`, it ends at the last
 * time of the day.
 */
export function listTimes(
  step: number,
  minTime: Temporal.PlainTime | undefined,
  maxTime: Temporal.PlainTime | undefined,
): Temporal.PlainTime[] {
  const times: Temporal.PlainTime[] = [];
  let time = minTime ?? new Temporal.PlainTime();
  while (!maxTime || Temporal.PlainTime.compare(time, maxTime) <= 0) {
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
