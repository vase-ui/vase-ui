import { LIBRARIES, SCENARIOS } from '../../benchmarks/scenarios.ts';
import type { Library } from '../../benchmarks/scenarios.ts';
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
  date?: string;
  commit: string;
  libraries: Record<string, { package: string; version: string }>;
  setups: Partial<Record<ResultSetup, { package: string; version: string }>>;
  tools: Record<string, string>;
  size: {
    emptyApp: Partial<Record<ResultSetup, Size>>;
    apps: Record<string, Partial<Record<ResultSetup, Partial<Record<LibraryId, Size | null>>>>>;
  };
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
}

export interface SizeTable {
  setup: TableSetup;
  /** The library ids of the columns, in the sequence of `LIBRARIES`. */
  columns: LibraryId[];
  rows: SizeRow[];
}

/** One row where another library adds fewer gzip bytes than Vase UI in the same table. */
export interface SizeLoss {
  setup: TableSetup;
  label: string;
  library: LibraryId;
  libraryBytes: number;
  vaseBytes: number;
}

export interface BenchmarksReport {
  date?: string;
  commit: string;
  libraries: { id: LibraryId; name: string; package: string; version: string }[];
  setups: { id: ResultSetup; name: string; package: string; version: string }[];
  tools: Record<string, string>;
  sizeTables: SizeTable[];
  sizeLosses: SizeLoss[];
  features: Features;
}

export const LIBRARY_NAMES: Record<LibraryId, string> = {
  'vase-ui': 'Vase UI',
  'reka-ui': 'Reka UI',
  'ark-ui': 'Ark UI',
  'headless-ui': 'Headless UI',
  vuetify0: 'Vuetify0',
  'base-ui': 'Base UI',
};

export const SETUP_NAMES: Record<ResultSetup, string> = {
  vdom: 'Virtual DOM app',
  'vapor-interop': 'Vapor app',
  react: 'React app',
};

const TABLE_SETUPS: TableSetup[] = ['vdom', 'vapor-interop'];
const RESULT_SETUPS: ResultSetup[] = [...TABLE_SETUPS, 'react'];

function labelOf(scenario: string): string {
  return scenario === 'AllComponents' ? 'All ten components' : scenario;
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

function sizeTable(results: Results, setup: TableSetup): SizeTable {
  const libraries = LIBRARIES.filter((library) => setup === 'vdom' || library.framework === 'vue');
  const emptyRow: SizeRow = { scenario: 'EmptyApp', label: 'Empty app', app: {}, added: {} };
  for (const library of libraries) {
    emptyRow.app[library.id] = cellOf(results.size.emptyApp[resultSetupOf(setup, library)]);
  }
  const rows = SCENARIOS.map((scenario): SizeRow => {
    const row: SizeRow = { scenario, label: labelOf(scenario), app: {}, added: {} };
    for (const library of libraries) {
      const resultSetup = resultSetupOf(setup, library);
      const app = cellOf(results.size.apps[scenario]?.[resultSetup]?.[library.id]);
      row.app[library.id] = app;
      row.added[library.id] = minus(app, emptyRow.app[library.id]);
    }
    return row;
  });
  return { setup, columns: libraries.map((library) => library.id), rows: [emptyRow, ...rows] };
}

/**
 * Each cell where another library adds fewer gzip bytes than Vase UI in the same row. The added
 * bytes leave out the framework, so a Base UI cell compares with Vase UI in the same way.
 */
export function sizeLossesOf(tables: readonly SizeTable[]): SizeLoss[] {
  return tables.flatMap((table) =>
    table.rows.flatMap((row) => {
      const vase = row.added['vase-ui'];
      if (row.scenario === 'EmptyApp' || vase === undefined || typeof vase === 'string') {
        return [];
      }
      return table.columns.flatMap((library) => {
        const other = row.added[library];
        if (library === 'vase-ui' || other === undefined || typeof other === 'string') {
          return [];
        }
        return other.gzip < vase.gzip
          ? [
              {
                setup: table.setup,
                label: row.label,
                library,
                libraryBytes: other.gzip,
                vaseBytes: vase.gzip,
              },
            ]
          : [];
      });
    }),
  );
}

export function benchmarksReportOf(results: Results, features: Features): BenchmarksReport {
  const sizeTables = TABLE_SETUPS.map((setup) => sizeTable(results, setup));
  return {
    ...(results.date === undefined ? {} : { date: results.date }),
    commit: results.commit,
    libraries: LIBRARIES.map((library) => ({
      id: library.id,
      name: LIBRARY_NAMES[library.id],
      package: results.libraries[library.id]?.package ?? library.package,
      version: results.libraries[library.id]?.version ?? 'not measured yet',
    })),
    setups: RESULT_SETUPS.flatMap((id) => {
      const setup = results.setups[id];
      return setup === undefined ? [] : [{ id, name: SETUP_NAMES[id], ...setup }];
    }),
    tools: results.tools,
    sizeTables,
    sizeLosses: sizeLossesOf(sizeTables),
    features,
  };
}

/** Reads `benchmarks/results.json` and `benchmarks/features.json`. */
export function loadBenchmarksReport(): BenchmarksReport {
  const read = (path: string): unknown =>
    JSON.parse(readRepositoryFile(REPOSITORY_ROOT, `benchmarks/${path}`));
  return benchmarksReportOf(read('results.json') as Results, read('features.json') as Features);
}
