import assert from 'node:assert/strict';
import { test } from 'node:test';
import { benchmarksReportOf } from './benchmarksReport.ts';
import type { Results, Size } from './benchmarksReport.ts';

function size(gzip: number): Size {
  return { raw: gzip * 3, gzip, brotli: gzip - 1 };
}

const results: Results = {
  date: '2026-01-01T00:00:00.000Z',
  commit: '0'.repeat(40),
  libraries: {},
  setups: {
    vdom: { package: 'vue', version: '3.5.0' },
    'vapor-interop': { package: 'vue', version: '3.6.0' },
    react: { package: 'react', version: '19.0.0' },
  },
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

/** Samples of 30 rounds, and the same samples times a factor. */
function rounds(factor = 1): number[] {
  return Array.from({ length: 30 }, (_, round) => (10 + (round % 7)) * factor);
}

const timed = benchmarksReportOf(
  {
    ...results,
    time: {
      chromium: {
        vdom: {
          browserVersion: '1.0',
          playwright: '1.0.0',
          machine: { os: 'Linux', cpu: 'CPU', cores: 4, memory: 2 ** 34 },
          cpuThrottle: 4,
          rounds: 30,
          metrics: {
            'Dialog.mount': { 'vase-ui': rounds(), 'reka-ui': rounds(0.8) },
            'Dialog.heap': { 'vase-ui': rounds(1000), 'reka-ui': rounds(900) },
            'Dialog.open': {
              'vase-ui': rounds(),
              'reka-ui': rounds(0.8),
              'ark-ui': { failed: 'No "open" state 5000 ms after the step.' },
              'headless-ui': rounds(1.2),
              vuetify0: null,
              'base-ui': rounds(1.01),
            },
          },
        },
      },
      firefox: {
        vdom: {
          browserVersion: '1.0',
          playwright: '1.0.0',
          machine: { os: 'Linux', cpu: 'CPU', cores: 4, memory: 2 ** 34 },
          cpuThrottle: null,
          rounds: 30,
          metrics: {
            'Dialog.mount': { 'vase-ui': rounds(), 'reka-ui': rounds() },
            'Dialog.open': { 'vase-ui': rounds(), 'reka-ui': rounds() },
          },
        },
      },
    },
  },
  { groups: [] },
);

test('a time table compares each library with Vase UI and keeps the reason of a failure', () => {
  const popup = timed.timeTables.find((table) => table.group === 'popup');
  const cells = popup?.rows.find((row) => row.metric === 'Dialog.open')?.cells;
  const vase = cells?.['vase-ui'];
  assert.ok(typeof vase === 'object' && vase.kind === 'samples' && vase.comparison === undefined);
  const reka = cells?.['reka-ui'];
  assert.ok(typeof reka === 'object' && reka.kind === 'samples');
  assert.equal(reka.comparison?.verdict, 'faster');
  assert.deepEqual(cells?.['ark-ui'], {
    kind: 'failed',
    reason: 'No "open" state 5000 ms after the step.',
  });
  assert.equal(cells?.vuetify0, 'not-provided');
});

test('the heap has a table of its own, in bytes', () => {
  const memory = timed.timeTables.find((table) => table.group === 'memory');
  assert.deepEqual(
    memory?.rows.map((row) => [row.metric, row.unit]),
    [['Dialog.heap', 'bytes']],
  );
  const reka = memory?.rows[0]?.cells['reka-ui'];
  assert.ok(typeof reka === 'object' && reka.kind === 'samples');
  assert.equal(reka.comparison?.verdict, 'faster');
});

test('a job has no table of a group with no metric, such as the heap in Firefox', () => {
  assert.deepEqual(
    timed.timeTables.map((table) => `${table.run.engine} ${table.group}`),
    ['chromium mount', 'chromium popup', 'chromium memory', 'firefox mount', 'firefox popup'],
  );
});

test('the list of losses names the measure of each time cell where another library is faster', () => {
  assert.deepEqual(
    timed.timeLosses.map((loss) => [loss.label, loss.library]),
    [
      ['Dialog: Mount', 'reka-ui'],
      ['Dialog: Open', 'reka-ui'],
      ['Dialog: Memory', 'reka-ui'],
    ],
  );
});

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
