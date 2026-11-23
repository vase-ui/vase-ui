import type { Check, Group } from '../../benchmarks/behavior/types.ts';
import { LIBRARIES, metricOf, SCENARIOS, VISITS } from '../../benchmarks/scenarios.ts';
import type { Library, Measure, Visit } from '../../benchmarks/scenarios.ts';
import { compare, median, quantile } from '../../benchmarks/statistics.ts';
import type { Comparison } from '../../benchmarks/statistics.ts';
import type {
  BehaviorCase,
  BehaviorResults,
  TimeCell,
  TimeResults,
} from '../../benchmarks/results.ts';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';

type LibraryId = Library['id'];
/** A setup with a table of its own on the page. The Base UI column goes in the `vdom` table. */
export type TableSetup = 'vdom' | 'vapor-interop';
export type ResultSetup = TableSetup | 'react';

export interface Size {
  raw: number;
  gzip: number;
  brotli: number;
}

/**
 * `null`: the library has no such component. `undefined`: `results.json` has no measure of the app
 * yet.
 */
type SizeResult = Size | null | undefined;

export interface Results {
  date: string;
  commit: string;
  /** The address of the workflow run that wrote the file. */
  run?: string;
  libraries: Record<string, { package: string; version: string }>;
  setups: Record<ResultSetup, { package: string; version: string }>;
  tools: Record<string, string>;
  size: {
    emptyApp: Partial<Record<ResultSetup, Size>>;
    apps: Record<string, Partial<Record<ResultSetup, Partial<Record<LibraryId, Size | null>>>>>;
  };
  /** The timing job of each engine and setup. */
  time?: Record<string, Partial<Record<TableSetup, TimeResults>>>;
  /** The behavior job of each engine. */
  behavior?: Record<string, BehaviorResults>;
}

export interface FeatureCell {
  value: string;
  note?: string;
  source: string;
}

export interface FeatureRow {
  feature: string;
  /** `support`: each value is `yes`, `no`, `partial` or `not-applicable`. `fact`: each value is a text. */
  kind: 'support' | 'fact';
  cells: Record<LibraryId, FeatureCell>;
}

export interface Features {
  groups: { name: string; rows: FeatureRow[] }[];
}

/** A note of `benchmarks/notes.json`: the behavior that costs the bytes, the time or the memory. */
export interface Note {
  /** The anchor of the note on the page. */
  id: string;
  title: string;
  /**
   * The metrics of the note: a metric of a time table, such as `Dialog.open`, or the size of a
   * scenario, such as `Dialog.size`.
   */
  measures: string[];
  /** One or two sentences. */
  reason: string;
  /** The pull requests and the measurements that show the reason. */
  sources: { name: string; url: string }[];
}

export interface Notes {
  notes: Note[];
}

/** A cell of a size table: the bytes, or the reason that there are none. */
export type SizeCell = Size | 'not-provided' | 'not-measured';

export interface SizeRow {
  /** The scenario, or `EmptyApp`. */
  scenario: string;
  label: string;
  /** The bytes of the app. */
  app: Record<string, SizeCell>;
  /** The bytes of the app minus the bytes of the empty app of its setup. Not in the row `EmptyApp`. */
  added: Record<string, SizeCell>;
  /**
   * The note of each unit in which another Vue library adds fewer bytes than Vase UI. Such a unit
   * with no note in `notes.json` is in `BenchmarksReport.missingNotes`.
   */
  notes: Partial<Record<SizeUnit, string>>;
}

export type SizeUnit = keyof Size;

export interface SizeTable {
  setup: TableSetup;
  /** The library ids of the columns, in the sequence of `LIBRARIES`. */
  columns: LibraryId[];
  rows: SizeRow[];
}

/** One row where another Vue library adds fewer gzip bytes than Vase UI in the same table. */
export interface SizeLoss {
  setup: TableSetup;
  label: string;
  library: LibraryId;
  libraryBytes: number;
  vaseBytes: number;
  /** The id of the note of the row, or `undefined` when `notes.json` has none. */
  note: string | undefined;
}

/** A group of time metrics with a heading of its own on the page. */
export type TimeGroup = 'mount' | 'popup' | 'list' | 'hydration' | 'memory';

/**
 * A cell of a time table. Each comparison is with Vase UI in the same table, and only a Vue library
 * has one. `note` is the id of the note of a cell where the library is faster or uses less memory.
 */
export type TimeTableCell =
  | { kind: 'samples'; median: number; p90: number; comparison?: Comparison; note?: string }
  | { kind: 'failed'; reason: string }
  | 'not-provided'
  | 'not-measured';

export interface TimeRow {
  /** The key of the metric in `results.json`, such as `Dialog.open`. */
  metric: string;
  /** The name of the row in its table, where the heading names the measure of a mount or a hydration. */
  label: string;
  /** The name of the scenario and of the measure, such as `Dialog: Mount`. */
  title: string;
  /** `bytes` for the heap, else milliseconds. */
  unit: 'ms' | 'bytes';
  cells: Record<string, TimeTableCell>;
}

/** One timing job, as the page names it. */
export interface TimeRun {
  engine: string;
  setup: TableSetup;
  browserVersion: string;
  machine: TimeResults['machine'];
  cpuThrottle: number | null;
  rounds: number;
}

export interface TimeTable {
  run: TimeRun;
  group: TimeGroup;
  columns: LibraryId[];
  rows: TimeRow[];
}

/** One metric where the whole interval of the ratio of another Vue library is below the band. */
export interface TimeLoss {
  engine: string;
  setup: TableSetup;
  /** The key of the metric, such as `Dialog.open`. */
  metric: string;
  label: string;
  unit: 'ms' | 'bytes';
  library: LibraryId;
  libraryMedian: number;
  vaseMedian: number;
  comparison: Comparison;
  /** The id of the note of the metric, or `undefined` when `notes.json` has none. */
  note: string | undefined;
}

/** The time of a Vue library over the time of Vase UI, across the time metrics of one engine. */
export interface Speed {
  library: LibraryId;
  /** The geometric mean of the ratios to Vase UI. */
  ratio: number;
  /** The metrics where Vase UI is faster, by the rule of the tables. */
  faster: number;
  /** The metrics where the two libraries have samples. */
  metrics: number;
  /** `LOSSES_ANCHOR` when the library is faster: the ratio is below 1. */
  losses: string | undefined;
}

/**
 * The verdict of one case over its runs. A case has a verdict when 2 of 3 runs, or the same part of
 * another count of runs, are valid. Else it is `not-measured`.
 */
export type BehaviorCaseVerdict = 'pass' | 'fail' | 'not-stable' | 'not-measured';

export interface BehaviorCaseResult {
  /** The case, or `null` for a check with no cases. */
  case: string | null;
  verdict: BehaviorCaseVerdict;
  passes: number;
  valid: number;
  measure: string;
  /** The reason of a fail, else the first line of an error. */
  reason?: string;
}

/** The verdict of a cell in one engine: `partly` when some cases pass and others do not. */
export type BehaviorVerdict = BehaviorCaseVerdict | 'partly';

export interface BehaviorEngineResult {
  engine: string;
  verdict: BehaviorVerdict;
  cases: BehaviorCaseResult[];
}

/** A cell of a behavior table. `not-measured`: no engine has a result of the check. */
export type BehaviorCell =
  | 'not-provided'
  | 'not-measured'
  | {
      /** The result of each engine that ran the check, in the sequence of the engines. */
      engines: BehaviorEngineResult[];
      /** Each case of the check that has no fixture of the library, such as `Tooltip`. */
      notProvided: string[];
      /**
       * The fixture files of the cell in the repository. `case` names the case of a check whose
       * cases have fixtures of their own.
       */
      fixtures: { case: string | null; path: string }[];
      /** The anchor of the loss of a Vase UI cell that does not pass in each engine. */
      loss?: string;
    };

export interface BehaviorRow {
  /** The key of the check in `results.json`, such as `nested-dialogs.focus-returns`. */
  key: string;
  /** The anchor of the row, such as `behavior-nested-dialogs-focus-returns`. */
  id: string;
  title: string;
  expectation: Check['expectation'];
  /** A fact row gives a measure and no verdict. */
  kind: 'check' | 'fact';
  cells: Record<string, BehaviorCell>;
}

export interface BehaviorTable {
  /** The id of the group, such as `nested-dialogs`. */
  group: string;
  title: string;
  /** The path of the group file in the repository. It holds the code of each check. */
  code: string;
  notes: Partial<Record<LibraryId, string>>;
  columns: LibraryId[];
  rows: BehaviorRow[];
}

/**
 * A cell of the behavior summary: the checks of a group that the library passes in each engine,
 * of the checks that have its fixture.
 */
export type BehaviorSummaryCell =
  'not-provided' | 'not-measured' | { passes: number; checks: number; loss?: string };

export interface BehaviorSummaryRow {
  group: string;
  title: string;
  cells: Record<string, BehaviorSummaryCell>;
}

/** A check that Vase UI does not pass in each engine. */
export interface BehaviorLoss {
  /** The anchor of the loss. The `*` of the Vase UI cell links it. */
  id: string;
  /** The anchor of the row of the check. */
  row: string;
  group: string;
  title: string;
  /** The result of each engine in which the Vase UI cell does not pass. */
  engines: BehaviorEngineResult[];
  /** The other Vue libraries that pass the check in each of these engines. */
  libraries: LibraryId[];
}

/** One behavior job, as the page names it. */
export interface BehaviorRun {
  engine: string;
  browserVersion: string;
  machine: BehaviorResults['machine'];
  runs: number;
}

export interface BenchmarksReport {
  date: string;
  commit: string;
  run: string | undefined;
  libraries: { id: LibraryId; name: string; package: string; version: string }[];
  setups: { id: ResultSetup; name: string; package: string; version: string }[];
  tools: Record<string, string>;
  sizeTables: SizeTable[];
  sizeLosses: SizeLoss[];
  timeRuns: TimeRun[];
  timeTables: TimeTable[];
  timeLosses: TimeLoss[];
  /** The time of each other Vue library against Vase UI, for each engine. */
  speed: { engine: string; libraries: Speed[] }[];
  behaviorRuns: BehaviorRun[];
  behaviorTables: BehaviorTable[];
  behaviorSummary: { columns: LibraryId[]; rows: BehaviorSummaryRow[] };
  behaviorLosses: BehaviorLoss[];
  /** The features, with the anchor of each row, such as `feature-nuxt-module`. */
  features: { groups: { name: string; rows: (FeatureRow & { id: string })[] }[] };
  notes: Note[];
  /** Each cell where Vase UI loses and `notes.json` has no note for its metric. */
  missingNotes: string[];
  /** Each metric of `notes.json` that no table has, or that more than one note names. */
  unknownMeasures: string[];
}

const LIBRARY_NAMES: Record<LibraryId, string> = {
  'vase-ui': 'Vase UI',
  'reka-ui': 'Reka UI',
  'ark-ui': 'Ark UI',
  'headless-ui': 'Headless UI',
  vuetify0: 'Vuetify0',
  'base-ui': 'Base UI',
};

const SETUP_NAMES: Record<ResultSetup, string> = {
  vdom: 'Virtual DOM app',
  'vapor-interop': 'Vapor app',
  react: 'React app',
};

const TABLE_SETUPS: TableSetup[] = ['vdom', 'vapor-interop'];
const RESULT_SETUPS: ResultSetup[] = [...TABLE_SETUPS, 'react'];

function labelOf(scenario: string): string {
  return scenario === 'AllComponents' ? 'All ten components' : scenario;
}

/** The libraries of the columns of a table: the React library is in the table of `vdom` only. */
function columnsOf(setup: TableSetup): Library[] {
  return LIBRARIES.filter((library) => setup === 'vdom' || library.framework === 'vue');
}

/** The setup whose results hold a column of a table. */
function resultSetupOf(table: TableSetup, library: Library): ResultSetup {
  return library.framework === 'react' ? 'react' : table;
}

function cellOf(size: SizeResult): SizeCell {
  if (size === undefined) {
    return 'not-measured';
  }
  return size ?? 'not-provided';
}

function minus(app: SizeCell, empty: SizeCell): SizeCell {
  if (typeof app === 'string') {
    return app;
  }
  if (typeof empty === 'string') {
    return 'not-measured';
  }
  return {
    raw: app.raw - empty.raw,
    gzip: app.gzip - empty.gzip,
    brotli: app.brotli - empty.brotli,
  };
}

/** A Vue library that the page compares with Vase UI. Base UI is a reference from React. */
function isCompared(id: LibraryId): boolean {
  return (
    id !== 'vase-ui' &&
    LIBRARIES.some((library) => library.id === id && library.framework === 'vue')
  );
}

const SIZE_UNITS: readonly SizeUnit[] = ['raw', 'gzip', 'brotli'];

/** The metric of the size of a scenario in `notes.json`, such as `Dialog.size`. */
function sizeMetricOf(scenario: string): string {
  return `${scenario}.size`;
}

/** The units in which another Vue library adds fewer bytes than Vase UI in the row. */
function losingUnits(row: SizeRow, columns: readonly LibraryId[]): SizeUnit[] {
  const vase = row.added['vase-ui'];
  if (vase === undefined || typeof vase === 'string') {
    return [];
  }
  return SIZE_UNITS.filter((unit) =>
    columns.some((library) => {
      const other = row.added[library];
      return isCompared(library) && typeof other === 'object' && other[unit] < vase[unit];
    }),
  );
}

type NoteOf = (metric: string) => string | undefined;

function sizeTable(results: Results, setup: TableSetup, noteOf: NoteOf): SizeTable {
  const libraries = columnsOf(setup);
  const columns = libraries.map((library) => library.id);
  const emptyRow: SizeRow = {
    scenario: 'EmptyApp',
    label: 'Empty app',
    app: {},
    added: {},
    notes: {},
  };
  for (const library of libraries) {
    emptyRow.app[library.id] = cellOf(results.size.emptyApp[resultSetupOf(setup, library)]);
  }
  const rows = SCENARIOS.map((scenario): SizeRow => {
    const row: SizeRow = { scenario, label: labelOf(scenario), app: {}, added: {}, notes: {} };
    for (const library of libraries) {
      const resultSetup = resultSetupOf(setup, library);
      const app = cellOf(results.size.apps[scenario]?.[resultSetup]?.[library.id]);
      row.app[library.id] = app;
      row.added[library.id] = minus(app, emptyRow.app[library.id]);
    }
    const note = noteOf(sizeMetricOf(scenario));
    for (const unit of losingUnits(row, columns)) {
      row.notes[unit] = note;
    }
    return row;
  });
  return { setup, columns, rows: [emptyRow, ...rows] };
}

/** Each cell where another Vue library adds fewer gzip bytes than Vase UI in the same row. */
function sizeLossesOf(tables: readonly SizeTable[]): SizeLoss[] {
  return tables.flatMap((table) =>
    table.rows.flatMap((row) => {
      const vase = row.added['vase-ui'];
      if (vase === undefined || typeof vase === 'string') {
        return [];
      }
      return table.columns.flatMap((library) => {
        const other = row.added[library];
        return isCompared(library) && typeof other === 'object' && other.gzip < vase.gzip
          ? [
              {
                setup: table.setup,
                label: row.label,
                library,
                libraryBytes: other.gzip,
                vaseBytes: vase.gzip,
                note: row.notes.gzip,
              },
            ]
          : [];
      });
    }),
  );
}

const MEASURE_NAMES: Record<Measure, string> = {
  mount: 'Mount',
  heap: 'Memory',
  open: 'Open',
  close: 'Close',
  openLong: 'Open, 1,000 options',
  highlight: 'Move the highlight, 1,000 options',
  filter: 'Filter, 1,000 options',
  hydrate: 'Hydrate',
};

/** The group of a measure: the heap has a table of its own. */
function groupOf(visit: Visit, measure: Measure): TimeGroup {
  return measure === 'heap' ? 'memory' : visit.kind;
}

const TIME_GROUPS: TimeGroup[] = ['mount', 'popup', 'list', 'hydration', 'memory'];

/** The engines of the time tables, in the sequence of the page. */
const ENGINES = ['chromium', 'firefox', 'webkit'];

/**
 * A cell of a time table. `reference` is the cell of Vase UI, or `undefined` in a column with no
 * comparison. `note` is the note of the metric.
 */
function timeCell(
  cell: TimeCell | undefined,
  reference: TimeCell | undefined,
  note: string | undefined,
): TimeTableCell {
  if (cell === undefined || (Array.isArray(cell) && cell.length === 0)) {
    return 'not-measured';
  }
  if (cell === null) {
    return 'not-provided';
  }
  if (!Array.isArray(cell)) {
    return { kind: 'failed', reason: cell.failed };
  }
  const comparison =
    Array.isArray(reference) && reference.length > 0 ? compare(cell, reference) : undefined;
  return {
    kind: 'samples',
    median: median(cell),
    p90: quantile(cell, 0.9),
    ...(comparison ? { comparison } : {}),
    ...(comparison?.verdict === 'faster' && note !== undefined ? { note } : {}),
  };
}

/** The row of a measure, or `undefined` when the job has no such metric. */
function timeRow(
  part: TimeResults,
  columns: readonly LibraryId[],
  visit: Visit,
  measure: Measure,
  noteOf: NoteOf,
): TimeRow | undefined {
  const metric = metricOf(visit.scenario, measure);
  const cells = part.metrics[metric];
  if (cells === undefined) {
    return undefined;
  }
  const title = `${labelOf(visit.scenario)}: ${MEASURE_NAMES[measure]}`;
  const note = noteOf(metric);
  return {
    metric,
    label: visit.kind === 'popup' || visit.kind === 'list' ? title : labelOf(visit.scenario),
    title,
    unit: measure === 'heap' ? 'bytes' : 'ms',
    cells: Object.fromEntries(
      columns.map((library) => [
        library,
        timeCell(cells[library], isCompared(library) ? cells['vase-ui'] : undefined, note),
      ]),
    ),
  };
}

interface TimePart {
  run: TimeRun;
  part: TimeResults;
}

/** Each timing job of `results.json`, in the sequence of the page. */
function timeParts(results: Results): TimePart[] {
  return ENGINES.flatMap((engine) =>
    TABLE_SETUPS.flatMap((setup) => {
      const part = results.time?.[engine]?.[setup];
      if (part === undefined) {
        return [];
      }
      const { browserVersion, machine, cpuThrottle, rounds } = part;
      return [{ run: { engine, setup, browserVersion, machine, cpuThrottle, rounds }, part }];
    }),
  );
}

/** The tables of each job. A job with no metric of a group, such as the heap in Firefox, has no table of it. */
function timeTables(parts: readonly TimePart[], noteOf: NoteOf): TimeTable[] {
  return parts.flatMap(({ run, part }) => {
    const columns = columnsOf(run.setup).map((library) => library.id);
    return TIME_GROUPS.flatMap((group) => {
      const rows = VISITS.flatMap((visit) =>
        visit.measures
          .filter((measure) => groupOf(visit, measure) === group)
          .flatMap((measure) => timeRow(part, columns, visit, measure, noteOf) ?? []),
      );
      return rows.length === 0 ? [] : [{ run, group, columns, rows }];
    });
  });
}

function timeLossesOf(tables: readonly TimeTable[]): TimeLoss[] {
  return tables.flatMap((table) =>
    table.rows.flatMap((row) => {
      const vase = row.cells['vase-ui'];
      if (vase === undefined || typeof vase === 'string' || vase.kind !== 'samples') {
        return [];
      }
      return table.columns.flatMap((library) => {
        const cell = row.cells[library];
        if (
          cell === undefined ||
          typeof cell === 'string' ||
          cell.kind !== 'samples' ||
          cell.comparison?.verdict !== 'faster'
        ) {
          return [];
        }
        return [
          {
            engine: table.run.engine,
            setup: table.run.setup,
            metric: row.metric,
            label: row.title,
            unit: row.unit,
            library,
            libraryMedian: cell.median,
            vaseMedian: vase.median,
            comparison: cell.comparison,
            note: cell.note,
          },
        ];
      });
    }),
  );
}

/** The anchor of the section "Where Vase UI is larger, slower or fails a check" of the benchmarks page. */
export const LOSSES_ANCHOR = 'where-vase-ui-is-larger-slower-or-fails-a-check';

/** The time metrics of each engine, as the ratio of each other Vue library to Vase UI. */
function speedOf(tables: readonly TimeTable[]): BenchmarksReport['speed'] {
  return ENGINES.flatMap((engine) => {
    const ratios = new Map<LibraryId, { logs: number[]; faster: number }>();
    for (const table of tables) {
      if (table.run.engine !== engine || table.group === 'memory') {
        continue;
      }
      for (const row of table.rows) {
        for (const library of table.columns) {
          const cell = row.cells[library];
          if (typeof cell !== 'object' || cell.kind !== 'samples' || !cell.comparison) {
            continue;
          }
          const entry = ratios.get(library) ?? { logs: [], faster: 0 };
          entry.logs.push(Math.log(cell.comparison.ratio));
          entry.faster += cell.comparison.verdict === 'slower' ? 1 : 0;
          ratios.set(library, entry);
        }
      }
    }
    const libraries = LIBRARIES.flatMap((library): Speed[] => {
      const entry = ratios.get(library.id);
      if (entry === undefined) {
        return [];
      }
      const ratio = Math.exp(entry.logs.reduce((sum, log) => sum + log, 0) / entry.logs.length);
      return [
        {
          library: library.id,
          ratio,
          faster: entry.faster,
          metrics: entry.logs.length,
          losses: ratio < 1 ? LOSSES_ANCHOR : undefined,
        },
      ];
    });
    return libraries.length === 0 ? [] : [{ engine, libraries }];
  });
}

/** The metrics that a note can name: each time metric and the size of each scenario. */
const NOTE_MEASURES = new Set([
  ...VISITS.flatMap((visit) => visit.measures.map((measure) => metricOf(visit.scenario, measure))),
  ...SCENARIOS.map(sizeMetricOf),
]);

/** Each metric of the notes that no table has, or that more than one note names. */
function unknownMeasuresOf(notes: readonly Note[]): string[] {
  const measures = notes.flatMap((note) => note.measures);
  return measures.filter(
    (measure, index) => !NOTE_MEASURES.has(measure) || measures.indexOf(measure) !== index,
  );
}

function missingNotesOf(sizeTables: readonly SizeTable[], timeLosses: readonly TimeLoss[]) {
  const size = sizeTables.flatMap((table) =>
    table.rows.flatMap((row) =>
      losingUnits(row, table.columns)
        .filter((unit) => row.notes[unit] === undefined)
        .map((unit) => `${table.setup} ${sizeMetricOf(row.scenario)}, ${unit} bytes`),
    ),
  );
  const time = timeLosses
    .filter((loss) => loss.note === undefined)
    .map((loss) => `${loss.engine} ${loss.setup} ${loss.metric}, ${loss.library}`);
  return [...size, ...time];
}

function caseVerdictOf(result: BehaviorCase, runs: number): BehaviorCaseVerdict {
  if (result.valid * 3 < runs * 2) {
    return 'not-measured';
  }
  if (result.passes === result.valid) {
    return 'pass';
  }
  return result.passes === 0 ? 'fail' : 'not-stable';
}

const CASE_VERDICTS: readonly BehaviorCaseVerdict[] = [
  'pass',
  'fail',
  'not-stable',
  'not-measured',
];

/**
 * Cases with one verdict give that verdict. Cases with a pass and another verdict give `partly`.
 * Other cases give the first verdict of `CASE_VERDICTS` that they have.
 */
function verdictOf(cases: readonly BehaviorCaseResult[]): BehaviorVerdict {
  const verdicts = new Set(cases.map((item) => item.verdict));
  const first = CASE_VERDICTS.find((verdict) => verdicts.has(verdict)) ?? 'not-measured';
  return first === 'pass' && verdicts.size > 1 ? 'partly' : first;
}

/** The file of a group, such as `benchmarks/behavior/nestedDialogs.ts` for `nested-dialogs`. */
function groupFileOf(group: Group): string {
  return `benchmarks/behavior/${group.id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}.ts`;
}

function fixtureFileOf(library: Library, scenario: string): string {
  return `benchmarks/libraries/${library.id}/behavior/${scenario}.${library.framework === 'react' ? 'tsx' : 'vue'}`;
}

function scenarioOfCase(check: Check, caseName: string | null): string | undefined {
  return typeof check.scenario === 'string'
    ? check.scenario
    : caseName === null
      ? undefined
      : check.scenario[caseName];
}

/** The anchor of the row of a check, such as `behavior-nested-dialogs-focus-returns`. */
function behaviorAnchor(group: Group, check: Check): string {
  return `behavior-${group.id}-${check.id}`;
}

/** Each behavior job of `results.json`, in the sequence of the engines. */
function behaviorParts(results: Results): { engine: string; part: BehaviorResults }[] {
  return ENGINES.flatMap((engine) => {
    const part = results.behavior?.[engine];
    return part === undefined ? [] : [{ engine, part }];
  });
}

function behaviorCell(
  group: Group,
  check: Check,
  library: Library,
  parts: readonly { engine: string; part: BehaviorResults }[],
): BehaviorCell {
  const key = `${group.id}.${check.id}`;
  const ran = parts.filter(({ part }) => part.checks[key] !== undefined);
  if (ran.length === 0) {
    return 'not-measured';
  }
  const engines = ran.flatMap(({ engine, part }): BehaviorEngineResult[] => {
    const cases = part.checks[key]?.[library.id];
    if (cases === null || cases === undefined) {
      return [];
    }
    const results = cases.map((item): BehaviorCaseResult => {
      const reason = item.reason ?? item.error;
      return {
        case: item.case,
        verdict: caseVerdictOf(item, part.runs),
        passes: item.passes,
        valid: item.valid,
        measure: item.measure,
        ...(reason === undefined ? {} : { reason }),
      };
    });
    return [{ engine, verdict: verdictOf(results), cases: results }];
  });
  if (engines.length === 0) {
    return 'not-provided';
  }
  const ranCases = new Set(engines.flatMap((engine) => engine.cases.map((item) => item.case)));
  const scenarios = new Set([...ranCases].flatMap((name) => scenarioOfCase(check, name) ?? []));
  return {
    engines,
    notProvided: (check.cases ?? []).filter(
      (name) => !scenarios.has(scenarioOfCase(check, name) ?? ''),
    ),
    fixtures:
      typeof check.scenario === 'string'
        ? [{ case: null, path: fixtureFileOf(library, check.scenario) }]
        : [...ranCases].flatMap((name) => {
            const scenario = scenarioOfCase(check, name);
            return name === null || scenario === undefined
              ? []
              : [{ case: name, path: fixtureFileOf(library, scenario) }];
          }),
    ...(library.id === 'vase-ui' &&
    check.kind !== 'fact' &&
    engines.some((engine) => engine.verdict !== 'pass')
      ? { loss: `loss-${group.id}-${check.id}` }
      : {}),
  };
}

function behaviorTablesOf(results: Results, groups: readonly Group[]): BehaviorTable[] {
  const parts = behaviorParts(results);
  return groups.map((group) => ({
    group: group.id,
    title: group.title,
    code: groupFileOf(group),
    notes: group.notes ?? {},
    columns: LIBRARIES.map((library) => library.id),
    rows: group.checks.map((check) => ({
      key: `${group.id}.${check.id}`,
      id: behaviorAnchor(group, check),
      title: check.title,
      expectation: check.expectation,
      kind: check.kind ?? 'check',
      cells: Object.fromEntries(
        LIBRARIES.map((library) => [library.id, behaviorCell(group, check, library, parts)]),
      ),
    })),
  }));
}

/** The checks of each group that each library passes in each engine. Fact rows do not count. */
function behaviorSummaryOf(tables: readonly BehaviorTable[]): BenchmarksReport['behaviorSummary'] {
  const columns = LIBRARIES.map((library) => library.id);
  const rows = tables.map((table) => {
    const checks = table.rows.filter((row) => row.kind === 'check');
    const cells = Object.fromEntries(
      columns.map((library): [string, BehaviorSummaryCell] => {
        const measured = checks.flatMap((row) => {
          const cell = row.cells[library];
          return typeof cell === 'object' ? [cell] : [];
        });
        if (measured.length === 0) {
          const missing = checks.some((row) => row.cells[library] === 'not-provided');
          return [library, missing ? 'not-provided' : 'not-measured'];
        }
        const loss = measured.find((cell) => cell.loss !== undefined)?.loss;
        return [
          library,
          {
            passes: measured.filter((cell) =>
              cell.engines.every((engine) => engine.verdict === 'pass'),
            ).length,
            checks: measured.length,
            ...(loss === undefined ? {} : { loss }),
          },
        ];
      }),
    );
    return { group: table.group, title: table.title, cells };
  });
  return { columns, rows };
}

/** Each check that Vase UI does not pass in each engine, with the Vue libraries that pass it. */
function behaviorLossesOf(tables: readonly BehaviorTable[]): BehaviorLoss[] {
  return tables.flatMap((table) =>
    table.rows.flatMap((row): BehaviorLoss[] => {
      const vase = row.cells['vase-ui'];
      if (typeof vase !== 'object' || vase.loss === undefined) {
        return [];
      }
      const engines = vase.engines.filter((engine) => engine.verdict !== 'pass');
      const libraries = table.columns.filter((library) => {
        const cell = row.cells[library];
        return (
          isCompared(library) &&
          typeof cell === 'object' &&
          engines.every((lost) =>
            cell.engines.some(
              (engine) => engine.engine === lost.engine && engine.verdict === 'pass',
            ),
          )
        );
      });
      return [
        { id: vase.loss, row: row.id, group: table.title, title: row.title, engines, libraries },
      ];
    }),
  );
}

/** The anchor of a row of the features table, such as `feature-nuxt-module`. */
function featureAnchor(feature: string): string {
  return `feature-${feature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export function benchmarksReportOf(
  results: Results,
  features: Features,
  { notes }: Notes,
  groups: readonly Group[],
): BenchmarksReport {
  const noteOf: NoteOf = (metric) => notes.find((note) => note.measures.includes(metric))?.id;
  const sizeTables = TABLE_SETUPS.map((setup) => sizeTable(results, setup, noteOf));
  const parts = timeParts(results);
  const tables = timeTables(parts, noteOf);
  const timeLosses = timeLossesOf(tables);
  const behaviorTables = behaviorTablesOf(results, groups);
  return {
    date: results.date,
    commit: results.commit,
    run: results.run,
    libraries: LIBRARIES.map((library) => ({
      id: library.id,
      name: LIBRARY_NAMES[library.id],
      ...results.libraries[library.id],
    })),
    setups: RESULT_SETUPS.map((id) => ({ id, name: SETUP_NAMES[id], ...results.setups[id] })),
    tools: results.tools,
    sizeTables,
    sizeLosses: sizeLossesOf(sizeTables),
    timeRuns: parts.map(({ run }) => run),
    timeTables: tables,
    timeLosses,
    speed: speedOf(tables),
    behaviorRuns: behaviorParts(results).map(({ engine, part }) => ({
      engine,
      browserVersion: part.browserVersion,
      machine: part.machine,
      runs: part.runs,
    })),
    behaviorTables,
    behaviorSummary: behaviorSummaryOf(behaviorTables),
    behaviorLosses: behaviorLossesOf(behaviorTables),
    features: {
      groups: features.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({ ...row, id: featureAnchor(row.feature) })),
      })),
    },
    notes,
    missingNotes: missingNotesOf(sizeTables, timeLosses),
    unknownMeasures: unknownMeasuresOf(notes),
  };
}

/**
 * Reads `benchmarks/results.json`, `benchmarks/features.json` and `benchmarks/notes.json`. The
 * groups are `GROUPS` of `benchmarks/behavior/groups.ts`.
 */
export function loadBenchmarksReport(groups: readonly Group[]): BenchmarksReport {
  const read = (path: string): unknown =>
    JSON.parse(readRepositoryFile(REPOSITORY_ROOT, `benchmarks/${path}`));
  return benchmarksReportOf(
    read('results.json') as Results,
    read('features.json') as Features,
    read('notes.json') as Notes,
    groups,
  );
}
