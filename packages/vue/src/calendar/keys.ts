import { compareDates, isSameDay } from '../common/date-time/temporal';
import type { DayOfWeek } from '../common/date-time/temporal';
import { getYearPageStart, startOfWeek } from './pages';

/**
 * A move of the focus by a key in a grid of days. A move by a duration adds it to the focused day.
 * `stepDays` is the step to the next day that can take the focus. Its sign is the direction.
 */
export type DayMove =
  { weekEdge: 'start' | 'end' } | { duration: Temporal.DurationLike; stepDays: number };

/**
 * The move of a key in a grid of days, and whether it extends the selection, or `null` for a key
 * that the grid does not handle. Shift with an arrow key extends a selection that can extend, and
 * else moves a month (left and right) or a year (up and down). Left and right swap in `rtl`.
 */
export function getDayMove(
  key: string,
  shiftKey: boolean,
  { rtl, canExtend }: { rtl: boolean; canExtend: boolean },
): { move: DayMove; extend: boolean } | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const amount = (key === 'ArrowRight') !== rtl ? 1 : -1;
      return shiftKey && !canExtend
        ? { move: { duration: { months: amount }, stepDays: amount }, extend: false }
        : { move: { duration: { days: amount }, stepDays: amount }, extend: shiftKey };
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      const amount = key === 'ArrowDown' ? 1 : -1;
      return shiftKey && !canExtend
        ? { move: { duration: { years: amount }, stepDays: amount }, extend: false }
        : { move: { duration: { days: amount * 7 }, stepDays: amount * 7 }, extend: shiftKey };
    }
    case 'PageUp':
    case 'PageDown': {
      const amount = key === 'PageDown' ? 1 : -1;
      return {
        move: { duration: shiftKey ? { years: amount } : { months: amount }, stepDays: amount },
        extend: false,
      };
    }
    case 'Home':
    case 'End':
      return shiftKey
        ? null
        : { move: { weekEdge: key === 'Home' ? 'start' : 'end' }, extend: false };
    default:
      return null;
  }
}

// A rule that disables each day stops the search after one year.
const MAX_STEPS = 366;

/**
 * The day that a move reaches, or `null` when the focus stays. The move never stops on a day that
 * cannot take the focus: it goes on in its direction, and it stops at `min` and `max`. A move to
 * the edge of a week stops at the first day of the week that can take the focus.
 */
export function findDayTarget(
  from: Temporal.PlainDate,
  move: DayMove,
  {
    firstDay,
    canFocus,
    min,
    max,
  }: {
    firstDay: DayOfWeek;
    canFocus: (date: Temporal.PlainDate) => boolean;
    min: Temporal.PlainDate | undefined;
    max: Temporal.PlainDate | undefined;
  },
): Temporal.PlainDate | null {
  if ('weekEdge' in move) {
    const first = startOfWeek(from, firstDay);
    const step = move.weekEdge === 'start' ? 1 : -1;
    const edge = move.weekEdge === 'start' ? first : first.add({ days: 6 });
    for (let day = edge; compareDates(day, from) * step <= 0; day = day.add({ days: step })) {
      if (canFocus(day)) return isSameDay(day, from) ? null : day;
    }
    return null;
  }
  let candidate = from.add(move.duration);
  if (min && compareDates(candidate, min) < 0) candidate = min;
  if (max && compareDates(candidate, max) > 0) candidate = max;
  for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
    if (canFocus(candidate)) return isSameDay(candidate, from) ? null : candidate;
    candidate = candidate.add({ days: move.stepDays });
    if (
      (move.stepDays < 0 && min && compareDates(candidate, min) < 0) ||
      (move.stepDays > 0 && max && compareDates(candidate, max) > 0)
    ) {
      return null;
    }
  }
  return null;
}

/**
 * A move of the focus by a key in a grid of months or years: by cells, to the first or the last
 * cell of the row, or by pages. A page is a year of months, or a page of years.
 */
export type CellMove = { cells: number } | { rowEdge: 'start' | 'end' } | { pages: number };

/** The move of a key in a grid of cells, or `null` for a key that the grid does not handle. */
export function getCellMove(
  key: string,
  { rtl, columns }: { rtl: boolean; columns: number },
): CellMove | null {
  const horizontal = rtl ? -1 : 1;
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

type CellUnit = 'month' | 'year';

function compareCells(unit: CellUnit, a: Temporal.PlainYearMonth, b: Temporal.PlainYearMonth) {
  return unit === 'month' ? Temporal.PlainYearMonth.compare(a, b) : a.year - b.year;
}

function stepCell(unit: CellUnit, cell: Temporal.PlainYearMonth, count: number) {
  return unit === 'month' ? cell.add({ months: count }) : cell.add({ years: count });
}

/**
 * The cell that a move reaches, or `null` when the focus stays. A cell is a month, or the first
 * month of a year. The move never stops on a cell that cannot take the focus, and it stops at the
 * cells of `min` and `max`.
 */
export function findCellTarget(
  from: Temporal.PlainYearMonth,
  move: CellMove,
  {
    unit,
    columns,
    visibleYears,
    canFocus,
    min,
    max,
  }: {
    unit: CellUnit;
    columns: number;
    visibleYears: number;
    canFocus: (cell: Temporal.PlainYearMonth) => boolean;
    min: Temporal.PlainYearMonth | undefined;
    max: Temporal.PlainYearMonth | undefined;
  },
): Temporal.PlainYearMonth | null {
  if ('rowEdge' in move) {
    const index =
      unit === 'month' ? from.month - 1 : from.year - getYearPageStart(from.year, visibleYears);
    const count = unit === 'month' ? from.monthsInYear : visibleYears;
    const rowStart = index - (index % columns);
    const edge = move.rowEdge === 'start' ? rowStart : Math.min(rowStart + columns, count) - 1;
    const direction = move.rowEdge === 'start' ? 1 : -1;
    for (let offset = edge - index; offset * direction <= 0; offset += direction) {
      const cell = stepCell(unit, from, offset);
      if (canFocus(cell)) return cell.equals(from) ? null : cell;
    }
    return null;
  }
  const direction = 'cells' in move ? move.cells : move.pages;
  const toCell = (month: Temporal.PlainYearMonth) =>
    unit === 'month' ? month : month.with({ month: 1 });
  let candidate =
    'cells' in move
      ? stepCell(unit, from, move.cells)
      : from.add({ years: unit === 'month' ? move.pages : move.pages * visibleYears });
  if (min && compareCells(unit, candidate, min) < 0) candidate = toCell(min);
  if (max && compareCells(unit, candidate, max) > 0) candidate = toCell(max);
  for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
    if (canFocus(candidate)) return candidate.equals(from) ? null : candidate;
    candidate = stepCell(unit, candidate, Math.sign(direction));
    if (
      (direction < 0 && min && compareCells(unit, candidate, min) < 0) ||
      (direction > 0 && max && compareCells(unit, candidate, max) > 0)
    ) {
      return null;
    }
  }
  return null;
}
