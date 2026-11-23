import type { Page } from 'playwright';
import type { Library } from '../scenarios.ts';

/** The result of one case of a check in one run. */
export interface CaseResult {
  /** `not-valid` when the frames of the run have a gap above the limit of `samples.ts`. */
  verdict: 'pass' | 'fail' | 'not-valid';
  /** What the run measured, such as `Count 0. Open: dialog 1.` */
  measure: string;
  /** Why the run failed. */
  reason?: string;
}

/** One row of a group: a behavior that a standard or a platform gives, and its check. */
export interface Check {
  id: string;
  /** The row text. */
  title: string;
  /** The source of the expectation. */
  expectation: { text: string; url: string };
  /**
   * The fixture: `libraries/<library>/behavior/<scenario>.vue`, or `.tsx` for React. A check whose
   * cases are other components has the fixture of each case.
   */
  scenario: string | Readonly<Record<string, string>>;
  /** The cases of the check. A check with no cases has one result. */
  cases?: readonly string[];
  /** A fact row gives a measure and no verdict. */
  kind?: 'fact';
  /**
   * Runs one case on a loaded page of the fixture. The runner opens each run in a new browser
   * context. A check with no `run` has no results yet.
   */
  run?: (page: Page, caseName: string | null) => Promise<CaseResult>;
}

export interface Group {
  id: string;
  title: string;
  /**
   * A note for a library whose docs give no pattern for a step, or call the component Alpha or
   * Preview. A note also names the animation form of a fixture, and a feature of the docs that the
   * fixture rules leave out.
   */
  notes?: Partial<Record<Library['id'], string>>;
  checks: readonly Check[];
}
