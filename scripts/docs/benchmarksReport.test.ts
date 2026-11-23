import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Check, Group } from '../../benchmarks/behavior/types.ts';
import type { BehaviorCase, BehaviorResults } from '../../benchmarks/results.ts';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { benchmarksReportOf, loadBenchmarksReport, LOSSES_ANCHOR } from './benchmarksReport.ts';
import type { BehaviorCell, Note, Results, Size } from './benchmarksReport.ts';

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
  [],
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
  [],
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
      libraries.map(({ library, ratio, faster, metrics, losses }) => [
        library,
        Math.round(ratio * 1000) / 1000,
        faster,
        metrics,
        losses,
      ]),
    ]),
    [
      [
        'chromium',
        [
          ['reka-ui', 0.8, 0, 2, LOSSES_ANCHOR],
          ['headless-ui', 1.2, 1, 1, undefined],
        ],
      ],
      ['firefox', [['reka-ui', 1.2, 2, 2, undefined]]],
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
    [],
  );
  assert.deepEqual(twice.unknownMeasures, ['Dialog.opened', 'Dialog.open']);
});

const run: Check['run'] = () => Promise.resolve({ verdict: 'pass', measure: '' });

const groups: Group[] = [
  {
    id: 'popup-animations',
    title: 'Popup animations',
    notes: { vuetify0: 'Note.' },
    checks: [
      {
        id: 'enter',
        title: 'Enter.',
        expectation: { text: 'Source', url: 'https://example.com/' },
        scenario: { Dialog: 'AnimatedDialog', Tooltip: 'AnimatedTooltip' },
        cases: ['Dialog', 'Tooltip'],
        run,
      },
      {
        id: 'exit',
        title: 'Exit.',
        expectation: { text: 'Source', url: 'https://example.com/' },
        scenario: 'AnimatedDialog',
        run,
      },
      {
        id: 'type',
        title: 'Type.',
        expectation: { text: 'Source', url: 'https://example.com/' },
        scenario: 'AnimatedDialog',
        kind: 'fact',
        run,
      },
      {
        id: 'later',
        title: 'Later.',
        expectation: { text: 'Source', url: 'https://example.com/' },
        scenario: 'AnimatedDialog',
      },
    ],
  },
  {
    id: 'nested-dialogs',
    title: 'Nested dialogs',
    checks: [
      {
        id: 'focus',
        title: 'Focus.',
        expectation: { text: 'Source', url: 'https://example.com/' },
        scenario: 'NestedDialogs',
        run,
      },
    ],
  },
];

/** One case over 3 runs. */
function behaviorCase(
  name: string | null,
  passes: number,
  valid = 3,
  reason?: string,
): BehaviorCase {
  return {
    case: name,
    passes,
    valid,
    measure: `${String(passes)} pass.`,
    ...(reason ? { reason } : {}),
  };
}

function behaviorPart(checks: BehaviorResults['checks']): BehaviorResults {
  return {
    browserVersion: '1.0',
    playwright: '1.0.0',
    machine: { os: 'Linux', cpu: 'CPU', cores: 4, memory: 2 ** 34 },
    runs: 3,
    checks,
  };
}

const checked = benchmarksReportOf(
  {
    ...results,
    behavior: {
      chromium: behaviorPart({
        'popup-animations.enter': {
          'vase-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 2)],
          'reka-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 0, 3, 'A jump.')],
          'ark-ui': [behaviorCase('Dialog', 2, 2), behaviorCase('Tooltip', 1, 1)],
          'headless-ui': [behaviorCase('Dialog', 3)],
          vuetify0: null,
          'base-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 3)],
        },
        'popup-animations.exit': {
          'vase-ui': [behaviorCase(null, 3)],
          'reka-ui': [behaviorCase(null, 3)],
          'ark-ui': [behaviorCase(null, 2)],
          'headless-ui': [{ ...behaviorCase(null, 0), error: 'TypeError: A step throws.' }],
          vuetify0: null,
          'base-ui': [behaviorCase(null, 3)],
        },
        'popup-animations.type': {
          'vase-ui': [behaviorCase(null, 0)],
          'reka-ui': [behaviorCase(null, 3)],
          'ark-ui': [behaviorCase(null, 3)],
          'headless-ui': [behaviorCase(null, 3)],
          vuetify0: null,
          'base-ui': [behaviorCase(null, 3)],
        },
      }),
      firefox: behaviorPart({
        'popup-animations.enter': {
          'vase-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 3)],
          'reka-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 3)],
          'ark-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 3)],
          'headless-ui': [behaviorCase('Dialog', 3)],
          vuetify0: null,
          'base-ui': [behaviorCase('Dialog', 3), behaviorCase('Tooltip', 3)],
        },
        'popup-animations.exit': {
          'vase-ui': [behaviorCase(null, 0, 3, 'The popup leaves at once.')],
          'reka-ui': [behaviorCase(null, 3)],
          'ark-ui': [behaviorCase(null, 0)],
          'headless-ui': [behaviorCase(null, 3)],
          vuetify0: null,
          'base-ui': [behaviorCase(null, 3)],
        },
      }),
    },
  },
  { groups: [] },
  { notes: [] },
  groups,
);

const [animations] = checked.behaviorTables;

function cellOf(check: string, library: string): BehaviorCell | undefined {
  return animations?.rows.find((row) => row.key === `popup-animations.${check}`)?.cells[library];
}

function verdicts(cell: BehaviorCell | undefined): string[] {
  return typeof cell === 'object'
    ? cell.engines.map(
        ({ engine, verdict, cases }) =>
          `${engine} ${verdict}: ${cases.map((item) => `${item.case ?? '-'} ${item.verdict}`).join(', ')}`,
      )
    : [String(cell)];
}

test('a case passes when each valid run passes, and needs 2 valid runs of 3', () => {
  assert.deepEqual(verdicts(cellOf('enter', 'ark-ui')), [
    'chromium partly: Dialog pass, Tooltip not-measured',
    'firefox pass: Dialog pass, Tooltip pass',
  ]);
  assert.deepEqual(verdicts(cellOf('exit', 'ark-ui')), [
    'chromium not-stable: - not-stable',
    'firefox fail: - fail',
  ]);
});

test('a behavior cell keeps the reason of a fail, and names each case with no fixture', () => {
  const reka = cellOf('enter', 'reka-ui');
  assert.ok(typeof reka === 'object');
  assert.deepEqual(verdicts(reka), [
    'chromium partly: Dialog pass, Tooltip fail',
    'firefox pass: Dialog pass, Tooltip pass',
  ]);
  assert.equal(reka.engines[0]?.cases[1]?.reason, 'A jump.');
  const headlessExit = cellOf('exit', 'headless-ui');
  assert.ok(typeof headlessExit === 'object');
  assert.equal(headlessExit.engines[0]?.cases[0]?.reason, 'TypeError: A step throws.');
  const headless = cellOf('enter', 'headless-ui');
  assert.ok(typeof headless === 'object');
  assert.deepEqual(headless.notProvided, ['Tooltip']);
  assert.deepEqual(headless.fixtures, [
    { case: 'Dialog', path: 'benchmarks/libraries/headless-ui/behavior/AnimatedDialog.vue' },
  ]);
  const base = cellOf('enter', 'base-ui');
  assert.ok(typeof base === 'object');
  assert.deepEqual(base.fixtures, [
    { case: 'Dialog', path: 'benchmarks/libraries/base-ui/behavior/AnimatedDialog.tsx' },
    { case: 'Tooltip', path: 'benchmarks/libraries/base-ui/behavior/AnimatedTooltip.tsx' },
  ]);
  const exit = cellOf('exit', 'vase-ui');
  assert.ok(typeof exit === 'object');
  assert.deepEqual(exit.fixtures, [
    { case: null, path: 'benchmarks/libraries/vase-ui/behavior/AnimatedDialog.vue' },
  ]);
});

test('a library with no fixture is not provided, and a check with no results is not measured', () => {
  assert.equal(cellOf('enter', 'vuetify0'), 'not-provided');
  assert.equal(cellOf('later', 'vase-ui'), 'not-measured');
  assert.equal(checked.behaviorTables[1]?.rows[0]?.cells['vase-ui'], 'not-measured');
  assert.equal(animations?.code, 'benchmarks/behavior/popupAnimations.ts');
  assert.deepEqual(animations?.notes, { vuetify0: 'Note.' });
});

test('a Vase UI check that does not pass in each engine is a loss, with the Vue libraries that pass it there', () => {
  const vase = cellOf('exit', 'vase-ui');
  assert.ok(typeof vase === 'object');
  assert.equal(vase.loss, 'loss-popup-animations-exit');
  assert.deepEqual(
    checked.behaviorLosses.map(({ id, row, engines, libraries }) => ({
      id,
      row,
      engines: engines.map(
        (engine) =>
          `${engine.engine} ${engine.verdict}: ${engine.cases.map((item) => `${item.verdict} ${item.reason ?? ''}`.trim()).join(', ')}`,
      ),
      libraries,
    })),
    [
      {
        id: 'loss-popup-animations-enter',
        row: 'behavior-popup-animations-enter',
        engines: ['chromium partly: pass, not-stable'],
        libraries: ['headless-ui'],
      },
      {
        id: 'loss-popup-animations-exit',
        row: 'behavior-popup-animations-exit',
        engines: ['firefox fail: fail The popup leaves at once.'],
        libraries: ['reka-ui', 'headless-ui'],
      },
    ],
  );
});

test('a fact row and a cell of another library are no loss of Vase UI', () => {
  const fact = cellOf('type', 'vase-ui');
  assert.ok(typeof fact === 'object');
  assert.equal(fact.loss, undefined);
  const reka = cellOf('enter', 'reka-ui');
  assert.ok(typeof reka === 'object');
  assert.equal(reka.loss, undefined);
});

test('the behavior summary counts the checks that pass in each engine, with no fact row', () => {
  assert.deepEqual(checked.behaviorSummary.rows, [
    {
      group: 'popup-animations',
      title: 'Popup animations',
      cells: {
        'vase-ui': { passes: 0, checks: 2, loss: 'loss-popup-animations-enter' },
        'reka-ui': { passes: 1, checks: 2 },
        'ark-ui': { passes: 0, checks: 2 },
        'headless-ui': { passes: 1, checks: 2 },
        vuetify0: 'not-provided',
        'base-ui': { passes: 2, checks: 2 },
      },
    },
    {
      group: 'nested-dialogs',
      title: 'Nested dialogs',
      cells: Object.fromEntries(
        ['vase-ui', 'reka-ui', 'ark-ui', 'headless-ui', 'vuetify0', 'base-ui'].map((library) => [
          library,
          'not-measured',
        ]),
      ),
    },
  ]);
  assert.deepEqual(
    checked.behaviorRuns.map(({ engine, runs }) => [engine, runs]),
    [
      ['chromium', 3],
      ['firefox', 3],
    ],
  );
});

// The root project has no DOM types, and the code of the checks uses them in the page. So the test
// loads the groups at run time.
const { GROUPS }: { GROUPS: readonly Group[] } = await import(
  pathToFileURL(join(REPOSITORY_ROOT, 'benchmarks/behavior/groups.ts')).href
);
const real = loadBenchmarksReport(GROUPS);

/** The anchor that VitePress gives a heading of plain words. */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// A new run can make Vase UI lose a cell. Then `benchmarks/notes.json` gives the behavior that
// costs the bytes, the time or the memory.
test('each cell where Vase UI loses in benchmarks/results.json has a note', () => {
  assert.deepEqual(real.missingNotes, [], 'Give each such metric a note in benchmarks/notes.json.');
  assert.deepEqual(real.unknownMeasures, []);
});

test('each cell of the summary below 1 has a * that links to the losses', () => {
  const unmarked = real.speed.flatMap(({ engine, libraries }) =>
    libraries
      .filter((speed) => speed.ratio < 1 && speed.losses !== LOSSES_ANCHOR)
      .map((speed) => `${engine} ${speed.library}`),
  );
  assert.deepEqual(unmarked, []);
  const page = readRepositoryFile(REPOSITORY_ROOT, 'docs/benchmarks.md');
  const headings = [...page.matchAll(/^## (.+)$/gm)].map((match) => anchorOf(match[1] ?? ''));
  assert.ok(headings.includes(LOSSES_ANCHOR));
});

/** The anchors of the rows of the features and behavior tables. */
const rowAnchors = [
  ...real.features.groups.flatMap((group) => group.rows.map((row) => row.id)),
  ...real.behaviorTables.flatMap((table) => table.rows.map((row) => row.id)),
];

test('each note, each table row and each behavior loss has an anchor of its own', () => {
  const anchors = [
    ...real.notes.map((each) => each.id),
    ...rowAnchors,
    ...real.behaviorLosses.map((loss) => loss.id),
  ];
  assert.deepEqual(
    anchors.filter((anchor, index) => anchors.indexOf(anchor) !== index),
    [],
  );
});

test('each link of the benchmarks page to a feature row or a behavior row finds the row', () => {
  const page = readRepositoryFile(REPOSITORY_ROOT, 'docs/benchmarks.md');
  const ids = new Set(rowAnchors);
  const links = [...page.matchAll(/\]\(#((?:feature|behavior)-[a-z0-9-]+)\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.some((id) => id?.startsWith('feature-')));
  assert.ok(links.some((id) => id?.startsWith('behavior-')));
  assert.deepEqual(
    links.filter((id) => !ids.has(id ?? '')),
    [],
  );
});

// The summary links each group by its id, so the heading of each group has the id as its anchor.
test('the benchmarks page has a heading and a table for each behavior group', () => {
  const page = readRepositoryFile(REPOSITORY_ROOT, 'docs/benchmarks.md');
  const sections = [
    ...page.matchAll(/^### (.+)\n\n<BenchmarksBehavior group="([a-z-]+)" \/>$/gm),
  ].map((match) => [anchorOf(match[1] ?? ''), match[2]]);
  assert.deepEqual(
    sections,
    real.behaviorTables.map((table) => [table.group, table.group]),
  );
});

test('each link of a behavior table to the code or to a fixture finds the file', () => {
  const files = real.behaviorTables.flatMap((table) => [
    table.code,
    ...table.rows.flatMap((row) =>
      Object.values(row.cells).flatMap((cell) =>
        typeof cell === 'object' ? cell.fixtures.map((fixture) => fixture.path) : [],
      ),
    ),
  ]);
  assert.ok(files.length > real.behaviorTables.length);
  assert.deepEqual(
    files.filter((file) => !existsSync(join(REPOSITORY_ROOT, file))),
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
