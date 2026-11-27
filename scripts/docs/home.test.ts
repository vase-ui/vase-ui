import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const INCLUDE = /<!--\s*@include:\s*(.*?)\s*-->/g;

const includes = [...readFileSync(join(DOCS_ROOT, 'index.md'), 'utf8').matchAll(INCLUDE)].map(
  ([, target]) => target,
);

test('docs/index.md includes the region home of README.md', () => {
  assert.ok(includes.includes('../README.md#home'));
});

test('the region donation of README.md is inside the region home, so the home page shows it', () => {
  const lines = readFileSync(join(DOCS_ROOT, '..', 'README.md'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim());
  const [homeStart, donationStart, donationEnd, homeEnd] = [
    '<!-- #region home -->',
    '<!-- #region donation -->',
    '<!-- #endregion donation -->',
    '<!-- #endregion home -->',
  ].map((marker) => lines.indexOf(marker));
  assert.ok(
    homeStart >= 0 &&
      homeStart < donationStart &&
      donationStart < donationEnd &&
      donationEnd < homeEnd,
    'README.md must have the region donation between the start and the end of the region home.',
  );
});
