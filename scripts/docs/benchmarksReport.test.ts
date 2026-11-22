import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { benchmarksReportOf, loadBenchmarksReport } from './benchmarksReport.ts';
import type { Note, Results, Size } from './benchmarksReport.ts';

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

function note(id: string, measures: string[]): Note {
  return { id, title: id, measures, reason: 'Reason.', sources: [] };
}

const report = benchmarksReportOf(
  results,
  { groups: [] },
  { notes: [note('size', ['Dialog.size'])] },
);

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
              'base-ui': rounds(0.5),
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
            'Dialog.mount': { 'vase-ui': rounds(), 'reka-ui': rounds(1.2) },
            'Dialog.open': { 'vase-ui': rounds(), 'reka-ui': rounds(1.2) },
          },
        },
      },
    },
  },
  { groups: [] },
  { notes: [note('open', ['Dialog.open']), note('memory', ['Dialog.heap'])] },
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

test('the list of losses names the measure and the note of each time cell where another Vue library is faster', () => {
  assert.deepEqual(
    timed.timeLosses.map((loss) => [loss.label, loss.library, loss.note]),
    [
      ['Dialog: Mount', 'reka-ui', undefined],
      ['Dialog: Open', 'reka-ui', 'open'],
      ['Dialog: Memory', 'reka-ui', 'memory'],
    ],
  );
});

test('a losing time cell links its note, and a losing cell with no note is missing', () => {
  const popup = timed.timeTables.find((table) => table.group === 'popup');
  const cells = popup?.rows.find((row) => row.metric === 'Dialog.open')?.cells;
  const reka = cells?.['reka-ui'];
  assert.ok(typeof reka === 'object' && reka.kind === 'samples');
  assert.equal(reka.note, 'open');
  const headless = cells?.['headless-ui'];
  assert.ok(typeof headless === 'object' && headless.kind === 'samples');
  assert.equal(headless.note, undefined);
  assert.deepEqual(timed.missingNotes, [
    'vdom Dialog.size, raw bytes',
    'vdom Dialog.size, gzip bytes',
    'vdom Dialog.size, brotli bytes',
    'chromium vdom Dialog.mount, reka-ui',
  ]);
});

test('Base UI is a reference: its cells have no ratio and no verdict, and it has no losses', () => {
  const popup = timed.timeTables.find((table) => table.group === 'popup');
  const base = popup?.rows.find((row) => row.metric === 'Dialog.open')?.cells['base-ui'];
  assert.ok(typeof base === 'object' && base.kind === 'samples');
  assert.equal(base.comparison, undefined);
  assert.ok(report.sizeLosses.every((loss) => loss.library !== 'base-ui'));
});

test('the list of losses has each Vue library that adds fewer gzip bytes than Vase UI', () => {
  assert.deepEqual(report.sizeLosses, [
    {
      setup: 'vdom',
      label: 'Dialog',
      library: 'reka-ui',
      libraryBytes: 40,
      vaseBytes: 50,
      note: 'size',
    },
  ]);
  const dialog = report.sizeTables[0]?.rows.find((row) => row.scenario === 'Dialog');
  assert.deepEqual(dialog?.notes, { raw: 'size', gzip: 'size', brotli: 'size' });
});

test('the speed of an engine is the geometric mean of the time ratios, with the count where Vase UI is faster', () => {
  assert.deepEqual(
    timed.speed.map(({ engine, libraries }) => [
      engine,
      libraries.map(({ library, ratio, faster, metrics }) => [
        library,
        Math.round(ratio * 1000) / 1000,
        faster,
        metrics,
      ]),
    ]),
    [
      [
        'chromium',
        [
          ['reka-ui', 0.8, 0, 2],
          ['headless-ui', 1.2, 1, 1],
        ],
      ],
      ['firefox', [['reka-ui', 1.2, 2, 2]]],
    ],
  );
});

test('a note names only metrics of the tables, each one time', () => {
  const twice = benchmarksReportOf(
    results,
    { groups: [] },
    {
      notes: [note('a', ['Dialog.open', 'Dialog.opened']), note('b', ['Dialog.open'])],
    },
  );
  assert.deepEqual(twice.unknownMeasures, ['Dialog.opened', 'Dialog.open']);
});

const real = loadBenchmarksReport();

// A new run can make Vase UI lose a cell. Then `benchmarks/notes.json` gives the behavior that
// costs the bytes, the time or the memory.
test('each cell where Vase UI loses in benchmarks/results.json has a note', () => {
  assert.deepEqual(real.missingNotes, [], 'Give each such metric a note in benchmarks/notes.json.');
  assert.deepEqual(real.unknownMeasures, []);
});

test('each note and each feature row has an anchor of its own', () => {
  const anchors = [
    ...real.notes.map((each) => each.id),
    ...real.features.groups.flatMap((group) => group.rows.map((row) => row.id)),
  ];
  assert.deepEqual(
    anchors.filter((anchor, index) => anchors.indexOf(anchor) !== index),
    [],
  );
});

test('each link of the benchmarks page to a feature row finds the row', () => {
  const page = readRepositoryFile(REPOSITORY_ROOT, 'docs/benchmarks.md');
  const ids = new Set(real.features.groups.flatMap((group) => group.rows.map((row) => row.id)));
  const links = [...page.matchAll(/\]\(#(feature-[a-z0-9-]+)\)/g)].map((match) => match[1]);
  assert.ok(links.length > 0);
  assert.deepEqual(
    links.filter((id) => !ids.has(id ?? '')),
    [],
  );
});

test('a size table tells a missing component from a missing measure', () => {
  const vapor = report.sizeTables.find((table) => table.setup === 'vapor-interop');
  const dialog = vapor?.rows.find((row) => row.scenario === 'Dialog');
  assert.equal(dialog?.app['reka-ui'], 'not-provided');
  assert.equal(dialog?.app['ark-ui'], 'not-measured');
  assert.deepEqual(dialog?.added['vase-ui'], { raw: 150, gzip: 50, brotli: 50 });
});
