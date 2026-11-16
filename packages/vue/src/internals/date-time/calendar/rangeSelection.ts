import { computed, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';
import { useControlled } from '../../../common/useControlled';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../createBaseUIEventDetails';
import { REASONS } from '../../reasons';
import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isSameDay, toPlainDate, withDate } from '../temporal';
import type { DateValue } from '../temporal';
import type { CalendarChangeEventDetails, CalendarChangeEventReason } from './calendarProps';
import type { CalendarSelection } from './daySelection';
import { isDisabledDay } from './dayState';

/**
 * The value of a range calendar: the first and the last day. A range in progress has its first
 * day and a `null` last day.
 */
export type RangeValue<Value extends DateValue = DateValue> = [
  start: Value | null,
  end: Value | null,
];

type RangeInput = readonly [DateValue | null, DateValue | null];

export type RangeChangeEventReason = CalendarChangeEventReason | typeof REASONS.drag;
export type RangeChangeEventDetails = VaseUIChangeEventDetails<RangeChangeEventReason>;

/** The first and the last day of a range, in the calendar of the grid. */
export interface DayRange {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

export interface RangeSelectionProps {
  value?: RangeInput | undefined;
  defaultValue?: RangeInput | undefined;
  minDays?: number | undefined;
  maxDays?: number | undefined;
  allowNonContiguousRanges?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  minDate?: DateValue | undefined;
  maxDate?: DateValue | undefined;
  disabledDates?: DateMatcher | undefined;
  unavailableDates?: DateMatcher | undefined;
}

export interface RangeSelectionEmit {
  (event: 'valueChange', value: any, details: RangeChangeEventDetails): void;
  (event: 'update:value', value: any): void;
}

/** The range states of a day. A day of the range has `selected` only when the user can select it. */
export interface RangeDayState {
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  rangeMiddle: boolean;
}

export interface RangeSelection extends CalendarSelection {
  /**
   * The range that the grid shows: the value, or the range that the next press or the end of a drag
   * makes while a range is in progress.
   */
  displayRange: ComputedRef<DayRange | null>;
  /**
   * Whether a range is in progress: the first day is picked and the last is not, or a drag has left
   * its first day.
   */
  selecting: ComputedRef<boolean>;
  /** Shows the range that a press on `date` makes. It does nothing when no range is in progress. */
  preview: (date: Temporal.PlainDate) => void;
  /**
   * Puts back the range from before the first press, or an empty range, and ends a drag. It
   * returns `false` when there is nothing to end.
   */
  cancel: (event: KeyboardEvent) => boolean;
  /**
   * Starts a drag from `date`. It returns `false` when the user cannot select that day. A drag that
   * is in progress is dropped.
   */
  beginDrag: (date: Temporal.PlainDate, pointerId: number) => boolean;
  isDragging: (pointerId: number) => boolean;
  /** Moves the end of the drag to `date`. A day that the user cannot select does not count. */
  dragTo: (date: Temporal.PlainDate) => void;
  /**
   * Ends the drag at `date`, or at the last day of the drag when `date` is `null`. A drag that
   * left its first day makes the range. A drag that did not is a click.
   */
  endDrag: (date: Temporal.PlainDate | null, event: PointerEvent) => void;
  cancelDrag: () => void;
  /** The day of the button under the point, or `null`. A press holds the pointer on one button. */
  dayAtPoint: (from: Element, clientX: number, clientY: number) => Temporal.PlainDate | null;
  /** Gives a day button to the drag, so that the drag finds the day under the pointer. */
  registerButton: (element: Element, getDate: () => Temporal.PlainDate) => () => void;
  /**
   * Whether `event` is the click after a drag. A click after a drag has the pointer button down
   * and up on different days, so it is not a press.
   */
  takeClickSuppression: (event: MouseEvent) => boolean;
}

const EMPTY_RANGE = Object.freeze([null, null] as const);

function single(date: Temporal.PlainDate): DayRange {
  return { start: date, end: date };
}

function isSameEnd(a: DateValue | null, b: DateValue | null): boolean {
  return a === null || b === null ? a === b : isSameDay(a, b);
}

function areEqual([a1, a2]: RangeInput, [b1, b2]: RangeInput): boolean {
  return isSameEnd(a1, b1) && isSameEnd(a2, b2);
}

/** The state of `date` for a range. `blocked` is `true` for a day that is disabled or unavailable. */
export function getRangeDayState(
  date: Temporal.PlainDate,
  range: DayRange | null,
  blocked: boolean,
): RangeDayState {
  if (!range) {
    return { selected: false, rangeStart: false, rangeEnd: false, rangeMiddle: false };
  }
  const fromStart = compareDates(date, range.start);
  const toEnd = compareDates(date, range.end);
  const isInside = fromStart >= 0 && toEnd <= 0;
  return {
    selected: isInside && !blocked,
    rangeStart: fromStart === 0,
    rangeEnd: toEnd === 0,
    rangeMiddle: isInside && fromStart > 0 && toEnd < 0,
  };
}

interface Drag {
  pointerId: number;
  anchor: Temporal.PlainDate;
  current: Temporal.PlainDate;
  /** Whether the drag was ever on another day than its first day. */
  moved: boolean;
}

/**
 * The selection of a range of days. A press on a day starts a range. A press on a second day ends
 * it, in the order of the calendar. A press that would make a range that is not valid starts a new
 * range at that day. A drag from one day to another makes a range in one change.
 *
 * A range is not valid when it has fewer days than `minDays` or more than `maxDays`, or when it
 * crosses a day that the user cannot select and `allowNonContiguousRanges` is off.
 */
export function useRangeSelection(
  props: RangeSelectionProps,
  emit: RangeSelectionEmit,
): RangeSelection {
  const [value, setValue] = useControlled<RangeInput>({
    controlled: () => props.value,
    default: () => props.defaultValue ?? EMPTY_RANGE,
    name: 'RangeCalendar',
    state: 'value',
  });

  const values = computed(() => value.value.filter((end): end is DateValue => end !== null));
  // The range of a value with two ends, in the order of the calendar.
  const committed = computed<DayRange | null>(() => {
    const [first, second] = value.value;
    if (first === null || second === null) {
      return null;
    }
    const a = toPlainDate(first);
    const b = toPlainDate(second);
    return compareDates(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
  });
  // The first day of a range in progress: a value with one end.
  const lone = computed(() => {
    const [first, second] = value.value;
    if (first !== null && second === null) {
      return toPlainDate(first);
    }
    return first === null && second !== null ? toPlainDate(second) : null;
  });

  const previewDate = shallowRef<Temporal.PlainDate | null>(null);
  const drag = shallowRef<Drag | null>(null);
  // The value from before the first press of a range in progress, for Escape, and the first day
  // that it belongs to. A value that the consumer gives later has another first day.
  let pending: { anchor: Temporal.PlainDate; before: RangeInput } | null = null;
  // The first day of a range that Shift with an arrow key extends, and the last day of that range.
  let extension: { anchor: Temporal.PlainDate; last: Temporal.PlainDate } | null = null;
  let suppressClick = false;
  const buttons = new Map<Element, () => Temporal.PlainDate>();

  const blocking = computed(() => ({
    disabled: props.disabled === true,
    minDate: props.minDate,
    maxDate: props.maxDate,
    disabledDates: props.disabledDates,
  }));

  /** Whether the user cannot select `date`. */
  function isBlocked(date: Temporal.PlainDate) {
    return isDisabledDay(date, blocking.value) || matches(date, props.unavailableDates);
  }

  function hasBlockedDay({ start, end }: DayRange) {
    for (let day = start; compareDates(day, end) <= 0; day = day.add({ days: 1 })) {
      if (isBlocked(day)) {
        return true;
      }
    }
    return false;
  }

  /** The range from `a` to `b`, or `null` when that range is not valid. */
  function rangeBetween(a: Temporal.PlainDate, b: Temporal.PlainDate): DayRange | null {
    const first = a.withCalendar(b.calendarId);
    const range = compareDates(first, b) <= 0 ? { start: first, end: b } : { start: b, end: first };
    const days = range.start.until(range.end, { largestUnit: 'days' }).days + 1;
    if (days < (props.minDays ?? 1) || days > (props.maxDays ?? Infinity)) {
      return null;
    }
    return props.allowNonContiguousRanges === true || !hasBlockedDay(range) ? range : null;
  }

  const displayRange = computed<DayRange | null>(() => {
    const dragged = drag.value;
    // A press that has not left its day can still be the first press of a click.
    if (dragged?.moved) {
      return rangeBetween(dragged.anchor, dragged.current) ?? single(dragged.anchor);
    }
    const first = lone.value;
    if (first) {
      const hovered = previewDate.value ?? first;
      return rangeBetween(first, hovered) ?? single(hovered);
    }
    return committed.value;
  });

  function isSelected(date: Temporal.PlainDate) {
    const range = committed.value;
    if (range) {
      return compareDates(date, range.start) >= 0 && compareDates(date, range.end) <= 0;
    }
    return lone.value !== null && isSameDay(lone.value, date);
  }

  /** The value before the range in progress started, or the value now. */
  function valueBefore(): RangeInput {
    const first = lone.value;
    return first && pending && isSameDay(pending.anchor, first) ? pending.before : value.value;
  }

  // A new end has the kind, the calendar, the time and the zone of the end that it replaces, else
  // of another end. Without one, it is a date in the ISO calendar.
  function createEnds(first: Temporal.PlainDate, second: Temporal.PlainDate | null): RangeValue {
    const [before1, before2] = valueBefore();
    const [current1, current2] = value.value;
    const fallback = before1 ?? before2 ?? current1 ?? current2 ?? undefined;
    const create = (date: Temporal.PlainDate, like: DateValue | undefined) =>
      like ? withDate(like, date) : date.withCalendar('iso8601');
    return [create(first, before1 ?? fallback), second && create(second, before2 ?? fallback)];
  }

  function commit(next: RangeValue, details: RangeChangeEventDetails) {
    if (areEqual(value.value, next)) {
      return false;
    }
    emit('valueChange', next, details);
    if (details.isCanceled) {
      return false;
    }
    emit('update:value', next);
    setValue(next);
    previewDate.value = null;
    return true;
  }

  function commitRange({ start, end }: DayRange, details: RangeChangeEventDetails) {
    if (commit(createEnds(start, end), details)) {
      pending = null;
    }
  }

  function start(date: Temporal.PlainDate, details: RangeChangeEventDetails) {
    const before = valueBefore();
    if (commit(createEnds(date, null), details)) {
      pending = { anchor: date, before };
    }
  }

  function press(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
    extension = null;
    const first = lone.value;
    const range = first && rangeBetween(first, date);
    if (range) {
      commitRange(range, details);
    } else {
      start(date, details);
    }
  }

  function extend(
    date: Temporal.PlainDate,
    details: CalendarChangeEventDetails,
    from: Temporal.PlainDate,
  ) {
    const anchor =
      lone.value ?? (extension && isSameDay(extension.last, from) ? extension.anchor : from);
    const range = rangeBetween(anchor, date);
    if (range) {
      commitRange(range, details);
      extension = { anchor, last: date };
    }
  }

  function preview(date: Temporal.PlainDate) {
    if (lone.value && !isBlocked(date)) {
      previewDate.value = date;
    }
  }

  function cancel(event: KeyboardEvent) {
    if (drag.value) {
      drag.value = null;
      return true;
    }
    const day = lone.value;
    if (!day || props.readOnly === true) {
      return false;
    }
    extension = null;
    const [first, second] =
      pending && isSameDay(pending.anchor, day) ? pending.before : EMPTY_RANGE;
    commit([first, second], createChangeEventDetails(REASONS.keyboard, event));
    pending = null;
    previewDate.value = null;
    return true;
  }

  function beginDrag(date: Temporal.PlainDate, pointerId: number) {
    suppressClick = false;
    extension = null;
    if (props.readOnly === true || isBlocked(date)) {
      drag.value = null;
      return false;
    }
    drag.value = { pointerId, anchor: date, current: date, moved: false };
    return true;
  }

  function dragTo(date: Temporal.PlainDate) {
    const dragged = drag.value;
    if (!dragged || isBlocked(date) || isSameDay(date, dragged.current)) {
      return;
    }
    drag.value = {
      ...dragged,
      current: date,
      moved: dragged.moved || !isSameDay(date, dragged.anchor),
    };
  }

  function endDrag(date: Temporal.PlainDate | null, event: PointerEvent) {
    const dragged = drag.value;
    drag.value = null;
    if (!dragged) {
      return;
    }
    const end = date && !isBlocked(date) ? date : dragged.current;
    if (!dragged.moved && isSameDay(end, dragged.anchor)) {
      return;
    }
    suppressClick = true;
    const range = rangeBetween(dragged.anchor, end);
    if (range) {
      commitRange(range, createChangeEventDetails(REASONS.drag, event));
    }
  }

  function dayAtPoint(from: Element, clientX: number, clientY: number) {
    const root = from.getRootNode() as Document | ShadowRoot;
    for (
      let element = root.elementFromPoint(clientX, clientY);
      element;
      element = element.parentElement
    ) {
      const getDate = buttons.get(element);
      if (getDate) {
        return getDate();
      }
    }
    return null;
  }

  return {
    values,
    multiselectable: computed(() => true),
    isSelected,
    press,
    extend,
    displayRange,
    selecting: computed(() => drag.value?.moved === true || lone.value !== null),
    preview,
    cancel,
    beginDrag,
    isDragging: (pointerId) => drag.value?.pointerId === pointerId,
    dragTo,
    endDrag,
    cancelDrag() {
      drag.value = null;
    },
    dayAtPoint,
    registerButton(element, getDate) {
      buttons.set(element, getDate);
      return () => {
        if (buttons.get(element) === getDate) {
          buttons.delete(element);
        }
      };
    },
    takeClickSuppression(event) {
      const isAfterDrag = suppressClick && event.detail > 0;
      if (isAfterDrag) {
        suppressClick = false;
      }
      return isAfterDrag;
    },
  };
}
