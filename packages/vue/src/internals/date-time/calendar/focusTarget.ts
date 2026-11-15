import { compareDates, isSameDay } from '../temporal';
import type { DayOfWeek } from '../temporal';
import { startOfWeek } from './monthGrid';

export interface TabStopOptions {
  /** The days of the pages that can take focus, in the order of the grid. */
  days: readonly Temporal.PlainDate[];
  /** The day that the user focused last. */
  focusedDate: Temporal.PlainDate | null;
  isSelected: (date: Temporal.PlainDate) => boolean;
  today: Temporal.PlainDate;
}

/**
 * The day that has the tab stop: the focused day, else the first selected day, else today, else
 * the first day. Each of them must be in `days`. The result is `null` when no day can take focus.
 */
export function getTabStop({
  days,
  focusedDate,
  isSelected,
  today,
}: TabStopOptions): Temporal.PlainDate | null {
  return (
    (focusedDate && days.find((day) => isSameDay(day, focusedDate))) ??
    days.find((day) => isSelected(day)) ??
    days.find((day) => isSameDay(day, today)) ??
    days[0] ??
    null
  );
}

/**
 * A move of the focus that a key makes. A move by a duration adds it to the focused day. A move to
 * the edge of a week goes to the first day of the week, or to its last day. `stepDays` is the step
 * to the next day that can take focus when the first day cannot. Its sign is the direction.
 */
export type KeyMove =
  { weekEdge: 'start' | 'end' } | { duration: Temporal.DurationLike; stepDays: number };

export interface KeyAction {
  move: KeyMove;
  /** Whether the key also adds the day that it moves to into the selection. */
  extend: boolean;
}

/**
 * The action of a key in a grid of days, or `null` for a key that the grid does not handle.
 * Shift with an arrow key extends the selection where the selection can extend, and else moves
 * a month (left and right) or a year (up and down).
 * @param isRtl Left and right swap in a right-to-left page.
 */
export function getKeyAction(
  key: string,
  shiftKey: boolean,
  { isRtl, canExtend }: { isRtl: boolean; canExtend: boolean },
): KeyAction | null {
  const horizontal = isRtl ? -1 : 1;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const amount = key === 'ArrowRight' ? horizontal : -horizontal;
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

// A matcher that disables every day must not make the search run for ever.
const MAX_STEPS = 366;

export interface KeyTargetOptions {
  firstDay: DayOfWeek;
  canFocus: (date: Temporal.PlainDate) => boolean;
  min: Temporal.PlainDate | undefined;
  max: Temporal.PlainDate | undefined;
}

/**
 * The day that a move of the focus reaches, or `null` when the focus stays. The move never stops on
 * a day that cannot take focus. It goes on in its direction to the next day that can, and it stops
 * at `min` and `max`. A move to the edge of a week stops at the first day of the week that can take
 * focus, and the focused day is the last one that it tries.
 */
export function findKeyTarget(
  from: Temporal.PlainDate,
  move: KeyMove,
  { firstDay, canFocus, min, max }: KeyTargetOptions,
): Temporal.PlainDate | null {
  if ('weekEdge' in move) {
    const first = startOfWeek(from, firstDay);
    const step = move.weekEdge === 'start' ? 1 : -1;
    const edge = move.weekEdge === 'start' ? first : first.add({ days: 6 });
    for (let day = edge; compareDates(day, from) * step <= 0; day = day.add({ days: step })) {
      if (canFocus(day)) {
        return isSameDay(day, from) ? null : day;
      }
    }
    return null;
  }

  let candidate = from.add(move.duration);
  if (min && compareDates(candidate, min) < 0) {
    candidate = min;
  }
  if (max && compareDates(candidate, max) > 0) {
    candidate = max;
  }
  for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
    if (canFocus(candidate)) {
      return isSameDay(candidate, from) ? null : candidate;
    }
    candidate = candidate.add({ days: move.stepDays });
    const isBeyondMin = move.stepDays < 0 && min && compareDates(candidate, min) < 0;
    const isBeyondMax = move.stepDays > 0 && max && compareDates(candidate, max) > 0;
    if (isBeyondMin || isBeyondMax) {
      return null;
    }
  }
  return null;
}
