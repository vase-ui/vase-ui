import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { LIBRARIES, SETUPS } from '../../benchmarks/scenarios.ts';
import type { Features, Results } from '../docs/benchmarksReport.ts';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';

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
      `Run "pnpm benchmarks:size" after the pin of ${library.package} moves.`,
    );
  }
});

test('results.json has the pinned version of the framework of each setup', () => {
  for (const setup of SETUPS) {
    assert.equal(
      results.setups[setup.id]?.version,
      versionOf(pins[setup.frameworkPackage]),
      `Run "pnpm benchmarks:size" after the pin of ${setup.frameworkPackage} moves.`,
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
