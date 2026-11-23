// The types of the parts `time` and `behavior` of `results.json`.

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

/** The result of one case of a behavior check for one library, over the runs. */
export interface BehaviorCase {
  /** The case, or `null` for a check with no cases. */
  case: string | null;
  /** The runs that passed. */
  passes: number;
  /** The runs whose frames have no gap above the limit of `behavior/samples.ts`. */
  valid: number;
  /** The measures of the runs, each one once. */
  measure: string;
  /** Why the case failed, from the measure of the first run that failed. */
  reason?: string;
  /** The first line of the first error of a run: a thrown step, a page error or a console error. */
  error?: string;
}

/** One behavior job: one engine. The Vue libraries run in the setup `vdom`, Base UI in `react`. */
export interface BehaviorResults {
  browserVersion: string;
  playwright: string;
  machine: TimeResults['machine'];
  /** The runs of each case. */
  runs: number;
  /**
   * The cases of each check, such as `nested-dialogs.focus-returns`, by library. A library with no
   * fixture for the check has `null`.
   */
  checks: Record<string, Record<string, BehaviorCase[] | null>>;
}
