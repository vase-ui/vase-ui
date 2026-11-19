import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PackageSize } from './measure.ts';
import { sizeReport } from './report.ts';

const base: PackageSize = {
  packed: 100,
  unpacked: 400,
  entries: {
    '@fixture/ui': { raw: 50, gzip: 30, brotli: 20 },
    '@fixture/ui/button': { raw: 40, gzip: 20, brotli: 0 },
    '@fixture/ui/old': { raw: 10, gzip: 6, brotli: 4 },
    '@fixture/ui/same': { raw: 20, gzip: 12, brotli: 8 },
  },
};
const merge: PackageSize = {
  packed: 110,
  unpacked: 380,
  entries: {
    '@fixture/ui': { raw: 50, gzip: 30, brotli: 21 },
    '@fixture/ui/button': { raw: 44, gzip: 15, brotli: 1 },
    '@fixture/ui/new': { raw: 6, gzip: 3, brotli: 2 },
    '@fixture/ui/same': { raw: 20, gzip: 12, brotli: 8 },
  },
};

test('compares tarballs and independent entries in bytes and percent', () => {
  const [visible, collapsed] = sizeReport(base, merge).split('<details>');
  const rows = visible.split('\n');
  for (const row of [
    '| Measure | Base (B) | Merge (B) | Change (B) | Change (%) |',
    '| Packed tarball | 100 | 110 | +10 | +10% |',
    '| Unpacked tarball | 400 | 380 | -20 | -5% |',
    '| Sum of entries (Raw) | 120 | 120 | 0 | 0% |',
    '| Sum of entries (gzip) | 68 | 60 | -8 | -11.76% |',
    '| Sum of entries (Brotli) | 32 | 32 | 0 | 0% |',
    '| `@fixture/ui` | Raw | 50 | 50 | 0 | 0% |',
    '|  | Brotli | 20 | 21 | +1 | +5% |',
    '| `@fixture/ui/button` | Raw | 40 | 44 | +4 | +10% |',
    '|  | gzip | 20 | 15 | -5 | -25% |',
    '|  | Brotli | 0 | 1 | +1 | — |',
    '| `@fixture/ui/new` (new) | Raw | — | 6 | +6 | — |',
    '| `@fixture/ui/old` (removed) | Raw | 10 | — | -10 | -100% |',
  ])
    assert.ok(rows.includes(row), row);
  assert.doesNotMatch(visible, /@fixture\/ui\/same/);
  assert.match(collapsed, /<summary>Unchanged entries \(1\)<\/summary>/);
  assert.match(collapsed, /\| `@fixture\/ui\/same` \| 20 \| 12 \| 8 \|/);
  assert.doesNotMatch(collapsed, /@fixture\/ui\/(old|new|button)/);
});

test('gives one line with real totals when every size matches', () => {
  assert.equal(
    sizeReport(base, base),
    'No size change. Packed 100 B, unpacked 400 B. Entries total 120 B raw, 68 B gzip and 32 B Brotli.',
  );
});

test('shows entries that exchange one byte while their totals match', () => {
  for (const key of ['raw', 'gzip', 'brotli'] as const) {
    const root = base.entries['@fixture/ui'];
    const same = base.entries['@fixture/ui/same'];
    const [changes] = sizeReport(base, {
      ...base,
      entries: {
        ...base.entries,
        '@fixture/ui': { ...root, [key]: root[key] + 1 },
        '@fixture/ui/same': { ...same, [key]: same[key] - 1 },
      },
    }).split('<details>');
    assert.match(changes, /\| `@fixture\/ui` \| Raw \|/);
    assert.match(changes, /\| `@fixture\/ui\/same` \| Raw \|/);
    assert.doesNotMatch(changes, /Only the packed size changed/);
  }
});

test('reports a change to either tarball size alone', () => {
  for (const key of ['packed', 'unpacked'] as const) {
    const report = sizeReport(base, { ...base, [key]: base[key] + 1 });
    assert.match(report, /<summary>Unchanged entries \(4\)<\/summary>/);
    assert.doesNotMatch(report, /Changed entries|No size change/);
    assert.equal(report.includes('Declaration order can vary'), key === 'packed');
  }
});

test('identifies an unavailable build and gives the totals of the other build', () => {
  const baseFailure = sizeReport(undefined, merge);
  assert.match(baseFailure, /Could not measure the base build/);
  assert.match(baseFailure, /Packed 110 B, unpacked 380 B/);
  const mergeFailure = sizeReport(base, undefined);
  assert.match(mergeFailure, /Could not measure the merge build/);
  assert.match(mergeFailure, /Packed 100 B, unpacked 400 B/);
  assert.equal(sizeReport(undefined, undefined), 'Could not measure either build.');
});
