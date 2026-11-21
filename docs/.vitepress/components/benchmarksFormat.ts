import type { SizeCell } from '../../../scripts/docs/benchmarksReport.ts';

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
