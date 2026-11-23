import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Check, Group } from '../../benchmarks/behavior/types.ts';
import { LIBRARIES, SETUPS } from '../../benchmarks/scenarios.ts';
import type { Features, Results } from '../docs/benchmarksReport.ts';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';

// The root project has no DOM types, and the code of the checks uses them in the page. So the test
// loads the groups at run time.
const {
  GROUPS,
  scenarioOf,
}: {
  GROUPS: readonly Group[];
  scenarioOf: (check: Check, caseName: string | null) => string | undefined;
} = await import(pathToFileURL(join(REPOSITORY_ROOT, 'benchmarks/behavior/groups.ts')).href);

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readRepositoryFile(REPOSITORY_ROOT, path)) as T;
}

function pinsOf(path: string): Record<string, string> {
  const manifest = readJson<Manifest>(path);
  return { ...manifest.dependencies, ...manifest.devDependencies };
}

const pins = pinsOf('benchmarks/package.json');
const results = readJson<Results>('benchmarks/results.json');
const features = readJson<Features>('benchmarks/features.json');

/** The version of a pin such as `3.5.46` or `npm:vue@3.6.0-rc.16`. */
function versionOf(pin: string | undefined): string | undefined {
  return pin?.replace(/^npm:.+@/, '');
}

// A pin moves only with a new run, so the page never shows the numbers of another version. The
// build of `@vase-ui/vue` is the commit of the run, so its version is not checked.
test('results.json has the pinned version of each library', () => {
  for (const library of LIBRARIES.filter((item) => item.id !== 'vase-ui')) {
    assert.equal(
      results.libraries[library.id]?.version,
      versionOf(pins[library.package]),
      `Record a run of the workflow Benchmarks after the pin of ${library.package} moves.`,
    );
  }
});

test('results.json has the pinned version of the framework of each setup', () => {
  for (const setup of SETUPS) {
    assert.equal(
      results.setups[setup.id]?.version,
      versionOf(pins[setup.frameworkPackage]),
      `Record a run of the workflow Benchmarks after the pin of ${setup.frameworkPackage} moves.`,
    );
  }
});

test('the benchmarks build and type the fixtures with the tool versions of packages/vue', () => {
  const packagePins = pinsOf('packages/vue/package.json');
  for (const tool of ['vite', '@vitejs/plugin-vue', 'vue-tsc', 'playwright']) {
    if (tool in pins) {
      assert.equal(pins[tool], packagePins[tool], `The pin of ${tool}`);
    }
  }
});

test('each feature row has a cell with a source for each library', () => {
  for (const row of features.groups.flatMap((group) => group.rows)) {
    for (const library of LIBRARIES) {
      const cell = row.cells[library.id];
      assert.ok(cell, `"${row.feature}" has no cell for ${library.id}.`);
      assert.match(cell.source, /^https:\/\//, `"${row.feature}", ${library.id}: the source`);
      if (row.kind === 'support') {
        assert.ok(
          ['yes', 'no', 'partial', 'not-applicable'].includes(cell.value),
          `"${row.feature}", ${library.id}: "${cell.value}" is not yes, no, partial or not-applicable.`,
        );
      }
    }
  }
});

test('the count of Vase UI components is the count of component pages', () => {
  const pages = readdirSync(join(REPOSITORY_ROOT, 'docs/components')).filter((file) =>
    file.endsWith('.md'),
  );
  const row = features.groups
    .flatMap((group) => group.rows)
    .find((item) => item.feature === 'Components in all');
  assert.equal(row?.cells['vase-ui'].value, String(pages.length));
});

test('each behavior check has a row text and an https source', () => {
  for (const group of GROUPS) {
    for (const check of group.checks) {
      assert.ok(check.title, `${group.id}.${check.id}: the row text`);
      assert.match(check.expectation.url, /^https:\/\//, `${group.id}.${check.id}: the source`);
    }
  }
});

// The page shows a check with no results as "Not measured", so a check with code needs a new run.
test('results.json has each behavior check that has code, in each engine', () => {
  const measured = GROUPS.flatMap((group) =>
    group.checks.filter((check) => check.run).map((check) => `${group.id}.${check.id}`),
  ).sort();
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    assert.deepEqual(
      Object.keys(results.behavior?.[engine]?.checks ?? {}).sort(),
      measured,
      `Record a run of the workflow Benchmarks with the behavior checks of ${engine}.`,
    );
  }
});

test('a behavior result is null only when the library has no fixture of the check', () => {
  for (const [engine, part] of Object.entries(results.behavior ?? {})) {
    for (const group of GROUPS) {
      for (const check of group.checks) {
        for (const library of LIBRARIES) {
          const cases = part.checks[`${group.id}.${check.id}`]?.[library.id];
          if (cases === undefined) {
            continue;
          }
          const extension = library.framework === 'react' ? 'tsx' : 'vue';
          const fixtures = (check.cases ?? [null])
            .map((caseName) => scenarioOf(check, caseName))
            .filter((scenario) =>
              existsSync(
                join(
                  REPOSITORY_ROOT,
                  `benchmarks/libraries/${library.id}/behavior/${String(scenario)}.${extension}`,
                ),
              ),
            );
          assert.equal(
            cases === null,
            fixtures.length === 0,
            `${engine} ${group.id}.${check.id}, ${library.id}`,
          );
        }
      }
    }
  }
});
