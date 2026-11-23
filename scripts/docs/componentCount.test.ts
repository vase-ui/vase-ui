import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readParityFiles, readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import type { Features } from './benchmarksReport.ts';
import { countComponents } from './components.ts';

const { upstream, families, problems } = readParityFiles(REPOSITORY_ROOT, { readExtracts: false });
assert.ok(upstream, problems.join('\n'));
const count = upstream.components.length;
const claim = `All ${count} Base UI components`;

/** Each count of Base UI components that the text gives. */
function countsIn(text: string): number[] {
  return [...text.matchAll(/(\d+) Base UI components/g)].map(([, value]) => Number(value));
}

const features: Features = JSON.parse(
  readRepositoryFile(REPOSITORY_ROOT, 'benchmarks/features.json'),
);
const rows = features.groups.flatMap((group) => group.rows);

test('the region home of README.md gives the count of parity/upstream.json, and README.md gives no other count', () => {
  const readme = readRepositoryFile(REPOSITORY_ROOT, 'README.md');
  const home = readme.slice(
    readme.indexOf('<!-- #region home -->'),
    readme.indexOf('<!-- #endregion home -->'),
  );
  assert.ok(home.includes(claim), `The region home of README.md must say "${claim}".`);
  assert.deepEqual(countsIn(readme), [count], `README.md must give only the count "${claim}".`);
});

test('the description of the package gives the count of parity/upstream.json, and no other count', () => {
  const { description }: { description: string } = JSON.parse(
    readRepositoryFile(REPOSITORY_ROOT, 'packages/vue/package.json'),
  );
  assert.ok(description.includes(claim), `The description must say "${claim}".`);
  assert.deepEqual(
    countsIn(description),
    [count],
    `The description must give only the count "${claim}".`,
  );
});

test('the parity page counts each component of parity/upstream.json as complete', () => {
  const { done, total } = countComponents(families, upstream.components);
  assert.deepEqual(
    { done, total },
    { done: count, total: count },
    `Each component of parity/upstream.json needs a complete family, because README.md must say "${claim}".`,
  );
});

test('each cell of the row "Components of Base UI" counts against the components of parity/upstream.json', () => {
  const row = rows.find(({ feature }) => feature === 'Components of Base UI');
  assert.ok(row, 'benchmarks/features.json has no row "Components of Base UI".');
  for (const [library, { value }] of Object.entries(row.cells)) {
    assert.match(
      value,
      new RegExp(`^\\d+ of ${count}$`),
      `"Components of Base UI", ${library}: count against the ${count} components of parity/upstream.json.`,
    );
  }
  assert.equal(row.cells['vase-ui'].value, `${count} of ${count}`);
  assert.equal(row.cells['base-ui'].value, `${count} of ${count}`);
});

test('the Base UI cell of the row "Components in all" gives the count of parity/upstream.json', () => {
  const row = rows.find(({ feature }) => feature === 'Components in all');
  assert.equal(row?.cells['base-ui'].value, String(count));
});
