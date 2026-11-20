import { computed, shallowRef, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import { isDisabledDay } from '../calendar/days';
import type { CalendarSelection } from '../calendar/root';
import type { CalendarRootChangeEventDetails } from '../calendar/types';
import { matches } from '../internals/date-time/matchers';
import { compareDates, isSameDay, toPlainDate, withDate } from '../internals/date-time/temporal';
import type { DateValue } from '../internals/date-time/temporal';
import type { RangeCalendarHost } from './host';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootProps,
  RangeCalendarRootValue,
} from './types';

type Value = RangeCalendarRootValue<DateValue>;

type Ends = readonly [DateValue | null, DateValue | null];

/** The first and the last day of a range, in the order of the calendar. */
interface DayRange {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

interface Drag {
  readonly pointerId: number;
  /** The button that holds the pointer. */
  readonly element: Element;
  readonly anchor: Temporal.PlainDate;
  current: Temporal.PlainDate;
  /** The drag left its first day. */
  moved: boolean;
}

const EMPTY: Ends = [null, null];

const single = (date: Temporal.PlainDate): DayRange => ({ start: date, end: date });

function isSameEnd(a: DateValue | null, b: DateValue | null) {
  return a === null || b === null ? a === b : isSameDay(a, b);
}

/**
 * The selection of a range. A press starts a range, and a press on a second day ends it, in the
 * order of the calendar. A press that makes a range that is not valid starts a new range there. A
 * drag makes a range in one change, and it ends at the last day toward the pointer that makes a
 * valid range. A range is not valid when it has fewer days than `minDays` or more than `maxDays`,
 * or when it crosses a day that the user cannot select and `allowNonContiguousRanges` is off.
 */
export function useRange(
  props: RangeCalendarRootProps<DateValue>,
  emit: {
    (event: 'valueChange', value: Value, details: RangeCalendarRootChangeEventDetails): void;
    (event: 'update:modelValue', value: Value): void;
  },
  host: RangeCalendarHost | null,
) {
  const model = useModel<Ends>(() => props.modelValue, props.defaultValue ?? EMPTY);
  const values = computed(() =>
    model.value.value.filter((end: DateValue | null): end is DateValue => end !== null),
  );
  // A range that becomes empty keeps its kind for the next end.
  const lastValue = shallowRef<DateValue | undefined>(values.value[0]);
  watch(
    () => values.value[0],
    (first) => {
      if (first) lastValue.value = first;
    },
  );
  const template = computed(
    () => values.value[0] ?? props.defaultValue?.[0] ?? props.defaultValue?.[1] ?? lastValue.value,
  );
  const committed = computed<DayRange | null>(() => {
    const [first, second] = model.value.value;
    if (first === null || second === null) return null;
    const a = toPlainDate(first);
    const b = toPlainDate(second);
    return compareDates(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
  });
  // The first day of a range in progress: a value with one end.
  const lone = computed(() => {
    const [first, second] = model.value.value;
    if (first !== null && second === null) return toPlainDate(first);
    return first === null && second !== null ? toPlainDate(second) : null;
  });

  const previewDate = shallowRef<Temporal.PlainDate | null>(null);
  const drag = shallowRef<Drag | null>(null);
  // The value from before the first press of a range in progress, for Escape, and the first day
  // that it belongs to. A value that the parent gives later has another first day.
  let pending: { anchor: Temporal.PlainDate; before: Ends } | null = null;
  // The first day of a range that Shift with an arrow key extends, and its last day.
  let extension: { anchor: Temporal.PlainDate; last: Temporal.PlainDate } | null = null;
  // The browsers send a click after a drag (test/measurements/calendar.test.ts). It is no press.
  let skipClick = false;

  const isBlocked = (date: Temporal.PlainDate) =>
    isDisabledDay(date, {
      disabled: !!props.disabled,
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
    }) || matches(date, props.unavailableDates);

  /** The last day from `anchor` toward `date` that ends a valid range with `anchor`, or `null`. */
  function lastValidEnd(anchor: Temporal.PlainDate, date: Temporal.PlainDate) {
    const step = compareDates(date, anchor) < 0 ? -1 : 1;
    const minDays = props.minDays ?? 1;
    const maxDays = props.maxDays ?? Infinity;
    let end: Temporal.PlainDate | null = null;
    for (let day = anchor, count = 1; count <= maxDays; day = day.add({ days: step }), count += 1) {
      const blocked = isBlocked(day);
      if (blocked && !props.allowNonContiguousRanges) break;
      if (!blocked && count >= minDays) end = day;
      if (isSameDay(day, date)) break;
    }
    return end;
  }

  /** The range from `a` to `b`, or `null` when that range is not valid. */
  function rangeBetween(a: Temporal.PlainDate, b: Temporal.PlainDate): DayRange | null {
    const first = a.withCalendar(b.calendarId);
    const end = lastValidEnd(first, b);
    if (!end || !isSameDay(end, b)) return null;
    return compareDates(first, b) <= 0 ? { start: first, end: b } : { start: b, end: first };
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
    if (range) return compareDates(date, range.start) >= 0 && compareDates(date, range.end) <= 0;
    return lone.value !== null && isSameDay(lone.value, date);
  }

  /** The value before the range in progress started, or the value now. */
  function valueBefore(): Ends {
    const first = lone.value;
    return first && pending && isSameDay(pending.anchor, first)
      ? pending.before
      : model.value.value;
  }

  function createEnds(first: Temporal.PlainDate, second: Temporal.PlainDate | null) {
    const [before1, before2] = valueBefore();
    const fallback = before1 ?? before2 ?? template.value;
    const create = (date: Temporal.PlainDate, like: DateValue | undefined) =>
      like ? withDate(like, date) : date.withCalendar('iso8601');
    return [
      create(first, before1 ?? fallback),
      second && create(second, before2 ?? fallback),
    ] as Value;
  }

  function commit(next: Value, details: RangeCalendarRootChangeEventDetails) {
    const [now1, now2] = model.value.value;
    if (isSameEnd(now1, next[0]) && isSameEnd(now2, next[1])) return false;
    emit('valueChange', next, details);
    if (details.isCanceled) return false;
    model.setOwn(next);
    emit('update:modelValue', next);
    previewDate.value = null;
    return true;
  }

  function commitRange({ start, end }: DayRange, details: RangeCalendarRootChangeEventDetails) {
    const changed = commit(createEnds(start, end), details);
    if (changed) pending = null;
    return changed;
  }

  function startRange(date: Temporal.PlainDate, details: RangeCalendarRootChangeEventDetails) {
    const before = valueBefore();
    if (commit(createEnds(date, null), details)) pending = { anchor: date, before };
  }

  // The reasons of a range root are a part of the reasons of a calendar.
  const toRange = (details: CalendarRootChangeEventDetails) =>
    details as RangeCalendarRootChangeEventDetails;

  const selection: CalendarSelection = {
    get values() {
      return values.value;
    },
    get template() {
      return template.value;
    },
    multiselectable: true,
    get range() {
      return displayRange.value;
    },
    isSelected,
    press(date, details) {
      if (skipClick && (details.event as MouseEvent).detail > 0) {
        skipClick = false;
        return;
      }
      extension = null;
      const first = lone.value;
      const range = first && rangeBetween(first, date);
      if (range) commitRange(range, toRange(details));
      else startRange(date, toRange(details));
    },
    extend(date, details, from) {
      const anchor =
        lone.value ?? (extension && isSameDay(extension.last, from) ? extension.anchor : from);
      // A key that gives a range that is not valid changes nothing, and the next key keeps the anchor.
      extension = { anchor, last: date };
      const range = rangeBetween(anchor, date);
      if (range) commitRange(range, toRange(details));
    },
  };

  function preview(date: Temporal.PlainDate) {
    if (lone.value && !props.readonly && !isBlocked(date)) previewDate.value = date;
  }

  /** Escape ends a drag, or puts back the range from before the first press of a range in progress. */
  function cancel(event: KeyboardEvent) {
    if (drag.value) {
      drag.value = null;
      // The release after Escape still clicks the button that holds the pointer.
      skipClick = true;
      return true;
    }
    const day = lone.value;
    if (!day || props.readonly || props.disabled) return false;
    extension = null;
    const before = pending && isSameDay(pending.anchor, day) ? pending.before : EMPTY;
    // A listener that cancels the change keeps the range in progress, so the next Escape puts
    // back the same range.
    if (commit([before[0], before[1]], createChangeEventDetails('keyboard', event))) pending = null;
    return true;
  }

  function dragTo(date: Temporal.PlainDate) {
    const dragged = drag.value;
    if (!dragged) return;
    const current = lastValidEnd(dragged.anchor, date) ?? dragged.anchor;
    const moved = dragged.moved || !isSameDay(date, dragged.anchor);
    if (moved !== dragged.moved || !isSameDay(current, dragged.current)) {
      drag.value = { ...dragged, current, moved };
    }
  }

  function endDrag(date: Temporal.PlainDate | null, event: PointerEvent) {
    if (date) dragTo(date);
    const dragged = drag.value;
    drag.value = null;
    if (!dragged?.moved) return;
    skipClick = true;
    if (props.readonly || props.disabled) return;
    const range = rangeBetween(dragged.anchor, dragged.current);
    if (!range) return;
    const details = createChangeEventDetails('drag', event);
    // The drag picks the range that the value already has, so the host learns of it.
    if (!commitRange(range, details) && !details.isCanceled) host?.onSameRange(event);
  }

  return {
    selection,
    selecting: computed(() => !!drag.value?.moved || lone.value !== null),
    cancel,
    /** Drops a drag whose button leaves the document. */
    dropDragOf(element: Element) {
      if (drag.value?.element === element) drag.value = null;
    },
    /** The listeners of a day button. `dayAt` finds the day of a button of the root. */
    dayButtonProps(
      day: Temporal.PlainDate,
      dayAt: (element: Element | null) => Temporal.PlainDate | null,
    ) {
      const dayAtPoint = (event: PointerEvent) => {
        const root = (event.currentTarget as Element).getRootNode() as Document | ShadowRoot;
        return dayAt(root.elementFromPoint(event.clientX, event.clientY));
      };
      const isDragging = (event: PointerEvent) => drag.value?.pointerId === event.pointerId;
      return {
        // A finger that drags over the days does not scroll the page.
        style: { touchAction: 'none' },
        onPointerdown(event: PointerEvent) {
          skipClick = false;
          extension = null;
          if (event.button !== 0 || props.readonly || isBlocked(day)) return;
          const element = event.currentTarget as Element;
          drag.value = {
            pointerId: event.pointerId,
            element,
            anchor: day,
            current: day,
            moved: false,
          };
          // The browser knows no pointer of an event that a script dispatches, and the method then
          // throws. The drag goes on with the events of the button.
          if (event.isTrusted) element.setPointerCapture(event.pointerId);
        },
        onPointermove(event: PointerEvent) {
          const date = isDragging(event) && dayAtPoint(event);
          if (date) dragTo(date);
        },
        onPointerup(event: PointerEvent) {
          if (isDragging(event)) endDrag(dayAtPoint(event), event);
        },
        onPointercancel(event: PointerEvent) {
          if (isDragging(event)) drag.value = null;
        },
        onPointerenter(event: PointerEvent) {
          if (event.pointerType !== 'touch') preview(day);
        },
        onFocus: () => preview(day),
      };
    },
  };
}
