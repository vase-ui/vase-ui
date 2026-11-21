import assert from 'node:assert/strict';
import { test } from 'node:test';
import { benchmarksReportOf } from './benchmarksReport.ts';
import type { Results, Size } from './benchmarksReport.ts';

function size(gzip: number): Size {
  return { raw: gzip * 3, gzip, brotli: gzip - 1 };
}

const results: Results = {
  commit: '0'.repeat(40),
  libraries: {},
  setups: {},
  tools: {},
  size: {
    emptyApp: { vdom: size(100), 'vapor-interop': size(200), react: size(500) },
    apps: {
      Dialog: {
        vdom: { 'vase-ui': size(150), 'reka-ui': size(140), 'headless-ui': size(160) },
        'vapor-interop': { 'vase-ui': size(250), 'reka-ui': null },
        react: { 'base-ui': size(540) },
      },
    },
  },
};

const report = benchmarksReportOf(results, { groups: [] });

test('the list of losses has each library that adds fewer gzip bytes than Vase UI', () => {
  assert.deepEqual(report.sizeLosses, [
    { setup: 'vdom', label: 'Dialog', library: 'reka-ui', libraryBytes: 40, vaseBytes: 50 },
    { setup: 'vdom', label: 'Dialog', library: 'base-ui', libraryBytes: 40, vaseBytes: 50 },
  ]);
});

test('a size table tells a missing component from a missing measure', () => {
  const vapor = report.sizeTables.find((table) => table.setup === 'vapor-interop');
  const dialog = vapor?.rows.find((row) => row.scenario === 'Dialog');
  assert.equal(dialog?.app['reka-ui'], 'not-provided');
  assert.equal(dialog?.app['ark-ui'], 'not-measured');
  assert.deepEqual(dialog?.added['vase-ui'], { raw: 150, gzip: 50, brotli: 50 });
});
