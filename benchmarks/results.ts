// The types of the part `time` of `results.json`, which `time.ts` writes.

/** The samples of a metric of a library: one for each round, in the order of the rounds. */
export type TimeCell = number[] | { failed: string } | null;

/** One timing job: one engine and one setup. */
export interface TimeResults {
  browserVersion: string;
  playwright: string;
  machine: { os: string; cpu: string; cores: number; memory: number };
  /** The CPU slowdown of Chromium, or `null` for an engine with no such control. */
  cpuThrottle: number | null;
  rounds: number;
  /** The samples of each metric, such as `Dialog.open`, by library. */
  metrics: Record<string, Record<string, TimeCell>>;
}
