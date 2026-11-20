import { afterAll, beforeAll } from 'vitest';
import type { RunnerTask, RunnerTestCase } from 'vitest';
import { checkFragmentChildren } from './checkFragmentChildren';
import expectations from './expectedFailures.json' with { type: 'json' };
import { isVueMinor } from './isVueMinor';

declare module 'vitest' {
  interface TaskMeta {
    vaporExpectation?: { name: string; fails: boolean };
  }
}

const files: Record<string, { fails: Record<string, string> }> = expectations.files;

// A suite can create a fixture vnode while Vitest collects its cases.
afterAll(checkFragmentChildren());

/** The titles of the suites of a case and its own title, with ` > ` between them. */
function nameOf(task: RunnerTask): string {
  const names = [task.name];
  for (let suite = task.suite; suite; suite = suite.suite) {
    if (suite.name !== '') {
      names.unshift(suite.name);
    }
  }
  return names.join(' > ');
}

function casesOf(tasks: readonly RunnerTask[]): RunnerTestCase[] {
  return tasks.flatMap((task) => (task.type === 'suite' ? casesOf(task.tasks) : [task]));
}

// Vitest reads `fails` after a case runs. A case with `fails` passes when it fails.
// It fails with `Expect test to fail` when it passes. Vitest has no public setter for `fails`.
// This hook sets it on the collected cases before the first case runs.
// `-t` and `only` keep each case in the file. A filter thus reports no absent entry for an
// unselected case.
// eslint-disable-next-line no-empty-pattern -- Vitest reads the first parameter as a fixture pattern, and the file is the second parameter.
beforeAll(({}, file) => {
  const fails = files[file.file.name]?.fails ?? {};
  const cases = Map.groupBy(casesOf(file.tasks), nameOf);
  const missing = Object.keys(fails).filter((name) => !cases.has(name));
  if (missing.length > 0) {
    throw new Error(
      `expectedFailures.json lists cases that ${file.file.name} does not have:\n${missing.join('\n')}`,
    );
  }
  for (const name of Object.keys(fails)) {
    for (const task of cases.get(name) ?? []) {
      task.fails = true;
      if (isVueMinor) {
        task.meta.vaporExpectation = { name, fails: true };
      }
    }
  }
});
