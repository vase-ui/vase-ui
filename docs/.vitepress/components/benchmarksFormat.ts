import type { SizeCell } from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';

const BYTES = new Intl.NumberFormat('en-US');

export function formatBytes(bytes: number): string {
  return BYTES.format(bytes);
}

export function sizeCellText(cell: SizeCell | undefined, unit: 'raw' | 'gzip' | 'brotli'): string {
  if (cell === undefined || cell === 'not-measured') {
    return 'Not measured yet';
  }
  if (cell === 'not-provided') {
    return 'Not provided';
  }
  return formatBytes(cell[unit]);
}

const RATIO = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Milliseconds with 3 significant digits, and no fraction from 1,000 up. */
export function formatMilliseconds(milliseconds: number): string {
  const digits = milliseconds < 1 ? 3 : milliseconds < 10 ? 2 : milliseconds < 100 ? 1 : 0;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(milliseconds)} ms`;
}

/** A median or a p90 of the heap can fall between two samples, so the bytes are rounded. */
export function formatMeasure(value: number, unit: 'ms' | 'bytes'): string {
  return unit === 'ms' ? formatMilliseconds(value) : `${formatBytes(Math.round(value))} bytes`;
}

export function formatRatio(ratio: number): string {
  return `${RATIO.format(ratio)}×`;
}

export function formatInterval([low, high]: readonly [number, number]): string {
  return `${RATIO.format(low)} to ${RATIO.format(high)}`;
}

const ENGINE_NAMES: Record<string, string> = {
  chromium: 'Chromium',
  firefox: 'Firefox',
  webkit: 'WebKit',
};

export function engineName(engine: string): string {
  return ENGINE_NAMES[engine] ?? engine;
}

export function libraryName(id: string): string {
  return data.libraries.find((library) => library.id === id)?.name ?? id;
}

/** The head of the column of a library in a table: Base UI is the one library for React. */
export function columnName(id: string): string {
  return id === 'base-ui' ? `${libraryName(id)} (React)` : libraryName(id);
}

export function setupName(setup: string): string {
  return data.setups.find((item) => item.id === setup)?.name ?? setup;
}

/** The setup with its version of Vue, such as `Vapor app, Vue 3.6.0-rc.16`. */
export function setupHeading(setup: string): string {
  const found = data.setups.find((item) => item.id === setup);
  return found === undefined ? setup : `${found.name}, Vue ${found.version}`;
}
