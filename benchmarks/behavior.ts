import { parseArgs } from 'node:util';
import type { Browser } from 'playwright';
import { scenarioOf } from './behavior/fixtures.ts';
import { GROUPS } from './behavior/groups.ts';
import { installRecorder } from './behavior/recorder.ts';
import type { CaseResult, Check } from './behavior/types.ts';
import { behaviorApp } from './build.ts';
import type { BehaviorCase, BehaviorResults } from './results.ts';
import {
  browserTypeOf,
  machine,
  PLAYWRIGHT_VERSION,
  readResults,
  reasonOf,
  startPreview,
  textOf,
  timeout,
  writeResults,
} from './runner.ts';
import { LIBRARIES, type Library } from './scenarios.ts';

/** A run that takes longer fails, so that one fault does not stop the job. */
const RUN_TIMEOUT = 60_000;

/** Each run opens a new context with these options, so that each machine gives the same page. */
const CONTEXT = {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'UTC',
  reducedMotion: 'no-preference',
} as const;

interface RunResult extends CaseResult {
  error?: string;
}

/** The address of the page of a fixture, from the folder `dist`, or `undefined` with no fixture. */
function pathOf(library: Library, scenario: string | undefined): string | undefined {
  if (scenario === undefined) {
    return undefined;
  }
  const app = behaviorApp(library, scenario);
  return app && `${app.setup.id}/${library.id}/behavior/${scenario}/`;
}

/** The cases of a check in an engine. Touch input goes through the protocol of Chromium only. */
function casesOf(check: Check, engine: string): (string | null)[] {
  const cases = check.cases ?? [null];
  return engine === 'chromium' ? [...cases] : cases.filter((caseName) => caseName !== 'touch');
}

/**
 * Runs one case of a check in a new context. A thrown step, a page error or a console error fails
 * the run.
 */
async function runOnce(
  browser: Browser,
  url: string,
  run: NonNullable<Check['run']>,
  caseName: string | null,
): Promise<RunResult> {
  const context = await browser.newContext({ ...CONTEXT, hasTouch: caseName === 'touch' });
  const limit = timeout(RUN_TIMEOUT);
  try {
    await context.addInitScript(installRecorder);
    const page = await context.newPage();
    const errors: Promise<string>[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(textOf(message));
      }
    });
    page.on('pageerror', (error) => errors.push(Promise.resolve(error.message)));
    const steps = async () => {
      await page.goto(url);
      await page.locator('[data-bench="instance"] > *').first().waitFor();
      return run(page, caseName);
    };
    const result = await Promise.race([steps(), limit.promise]);
    const [error] = await Promise.all(errors);
    return error === undefined
      ? result
      : { verdict: 'fail', measure: result.measure, error: reasonOf(error) };
  } catch (error) {
    return { verdict: 'fail', measure: '', error: reasonOf(error) };
  } finally {
    limit.clear();
    await context.close();
  }
}

function summaryOf(caseName: string | null, runs: readonly RunResult[]): BehaviorCase {
  const valid = runs.filter((run) => run.verdict !== 'not-valid');
  const reason = runs.find((run) => run.reason !== undefined)?.reason;
  const error = runs.find((run) => run.error !== undefined)?.error;
  return {
    case: caseName,
    passes: valid.filter((run) => run.verdict === 'pass').length,
    valid: valid.length,
    measure: [...new Set(runs.map((run) => run.measure).filter(Boolean))].join(' / '),
    ...(reason === undefined ? {} : { reason }),
    ...(error === undefined ? {} : { error }),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      engine: { type: 'string', default: 'chromium' },
      runs: { type: 'string', default: '3' },
      group: { type: 'string' },
    },
  });
  const engine = values.engine;
  const browserType = browserTypeOf(engine);
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs is a whole number of 1 or more, not ${values.runs}.`);
  }
  const groups = GROUPS.filter((group) => values.group === undefined || group.id === values.group);
  if (groups.length === 0) {
    throw new Error(
      `--group is ${GROUPS.map((group) => group.id).join(', ')}, not ${String(values.group)}.`,
    );
  }

  const server = await startPreview();
  const browser = await browserType.launch();
  const part: BehaviorResults = {
    browserVersion: browser.version(),
    playwright: PLAYWRIGHT_VERSION,
    machine: machine(),
    runs,
    checks: {},
  };
  try {
    for (const group of groups) {
      for (const check of group.checks) {
        const { run } = check;
        if (run === undefined) {
          continue;
        }
        const key = `${group.id}.${check.id}`;
        const cells: BehaviorResults['checks'][string] = {};
        for (const library of LIBRARIES) {
          const cases: BehaviorCase[] = [];
          for (const caseName of casesOf(check, engine)) {
            const path = pathOf(library, scenarioOf(check, caseName));
            if (path === undefined) {
              continue;
            }
            const results: RunResult[] = [];
            for (let index = 0; index < runs; index++) {
              results.push(
                await runOnce(browser, new URL(path, server.origin).href, run, caseName),
              );
            }
            const summary = summaryOf(caseName, results);
            cases.push(summary);
            console.log(
              `${key}${caseName === null ? '' : ` (${caseName})`}, ${library.id}: ${String(summary.passes)} of ${String(runs)} pass. ${summary.error ?? summary.reason ?? summary.measure}`,
            );
          }
          cells[library.id] = cases.length === 0 ? null : cases;
        }
        part.checks[key] = cells;
      }
      const results = readResults();
      const behavior = results.behavior as Record<string, BehaviorResults> | undefined;
      writeResults({ ...results, behavior: { ...behavior, [engine]: part } });
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.main) {
  await main();
}
