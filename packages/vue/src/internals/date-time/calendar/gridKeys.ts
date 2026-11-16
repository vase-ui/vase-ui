import { getYearPageStart } from './viewPages';

/** A cell of the grid of months is a month, and a cell of the grid of years is its first month. */
export type GridUnit = 'month' | 'year';

/**
 * A move of the focus that a key makes in a grid of months or years: by cells, to the first or last
 * cell of the row, or by pages. A page is a year in the grid of months, and the years of a page in
 * the grid of years. The sign is the direction.
 */
export type GridMove = { cells: number } | { rowEdge: 'start' | 'end' } | { pages: number };

/**
 * The move of a key in a grid, or `null` for a key that the grid does not handle.
 * @param isRtl Left and right swap in a right-to-left page.
 * @param columns The cells of a row. Up and down move by a row.
 */
export function getGridMove(
  key: string,
  { isRtl, columns }: { isRtl: boolean; columns: number },
): GridMove | null {
  const horizontal = isRtl ? -1 : 1;
  switch (key) {
    case 'ArrowLeft':
      return { cells: -horizontal };
    case 'ArrowRight':
      return { cells: horizontal };
    case 'ArrowUp':
      return { cells: -columns };
    case 'ArrowDown':
      return { cells: columns };
    case 'Home':
      return { rowEdge: 'start' };
    case 'End':
      return { rowEdge: 'end' };
    case 'PageUp':
      return { pages: -1 };
    case 'PageDown':
      return { pages: 1 };
    default:
      return null;
  }
}

// A function that disables every cell must not make the search run for ever.
const MAX_STEPS = 366;

export interface GridTargetOptions {
  unit: GridUnit;
  /** The cells of a row. */
  columns: number;
  /** The years of a page of years. */
  visibleYears: number;
  canFocus: (cell: Temporal.PlainYearMonth) => boolean;
  /** The first and the last month that the limits allow. A year cell is out when its year is out. */
  min: Temporal.PlainYearMonth | undefined;
  max: Temporal.PlainYearMonth | undefined;
}

function compare(unit: GridUnit, a: Temporal.PlainYearMonth, b: Temporal.PlainYearMonth) {
  return unit === 'month' ? Temporal.PlainYearMonth.compare(a, b) : a.year - b.year;
}

function stepBy(unit: GridUnit, cell: Temporal.PlainYearMonth, count: number) {
  return unit === 'month' ? cell.add({ months: count }) : cell.add({ years: count });
}

// The cell of a limit: the month itself, or the first month of its year.
function toCell(unit: GridUnit, month: Temporal.PlainYearMonth) {
  return unit === 'month' ? month : month.with({ month: 1 });
}

/**
 * The cell that a move of the focus reaches, or `null` when the focus stays. The move never stops
 * on a cell that cannot take focus. It goes on in its direction to the next cell that can, and it
 * stops at `min` and `max`. A move to the edge of a row stops at the first cell of the row that
 * can take focus, and the focused cell is the last one that it tries.
 */
export function findGridTarget(
  from: Temporal.PlainYearMonth,
  move: GridMove,
  { unit, columns, visibleYears, canFocus, min, max }: GridTargetOptions,
): Temporal.PlainYearMonth | null {
  if ('rowEdge' in move) {
    const index =
      unit === 'month' ? from.month - 1 : from.year - getYearPageStart(from.year, visibleYears);
    const count = unit === 'month' ? from.monthsInYear : visibleYears;
    const rowStart = index - (index % columns);
    const edge = move.rowEdge === 'start' ? rowStart : Math.min(rowStart + columns, count) - 1;
    const direction = move.rowEdge === 'start' ? 1 : -1;
    for (let offset = edge - index; offset * direction <= 0; offset += direction) {
      const cell = stepBy(unit, from, offset);
      if (canFocus(cell)) {
        return cell.equals(from) ? null : cell;
      }
    }
    return null;
  }

  const direction = 'cells' in move ? move.cells : move.pages;
  let candidate =
    'cells' in move
      ? stepBy(unit, from, move.cells)
      : from.add({ years: unit === 'month' ? move.pages : move.pages * visibleYears });
  if (min && compare(unit, candidate, min) < 0) {
    candidate = toCell(unit, min);
  }
  if (max && compare(unit, candidate, max) > 0) {
    candidate = toCell(unit, max);
  }
  for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
    if (canFocus(candidate)) {
      return candidate.equals(from) ? null : candidate;
    }
    candidate = stepBy(unit, candidate, Math.sign(direction));
    const isBeyondMin = direction < 0 && min && compare(unit, candidate, min) < 0;
    const isBeyondMax = direction > 0 && max && compare(unit, candidate, max) > 0;
    if (isBeyondMin || isBeyondMax) {
      return null;
    }
  }
  return null;
}
