import { computed, inject, shallowRef, watchSyncEffect } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { dayStateAttributesMapping } from '../../calendar/root/CalendarRootContext';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { isDisabledDay } from '../../internals/date-time/calendar/dayState';
import type {
  CalendarBaseChangeEventDetails,
  CalendarBaseChangeEventReason,
} from '../../internals/date-time/calendar/useCalendarRoot';
import { matches } from '../../internals/date-time/matchers';
import { compareDates, isSameDay, toPlainDate, withDate } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { REASONS } from '../../internals/reasons';
import type { RangeCalendarDayState } from '../day/RangeCalendarDay.vue';
import * as RangeCalendarDayDataAttributes from '../day/RangeCalendarDayDataAttributes';
import type { RangeCalendarRootProps } from './RangeCalendarRoot.vue';

type RangeSelection = ReturnType<typeof useRangeSelection>;

export const RangeCalendarRootContext: InjectionKey<RangeSelection> = Symbol();

export function useRangeCalendarRootContext(): RangeSelection {
  const context = inject(RangeCalendarRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of RangeCalendar must be inside <RangeCalendar.Root>. Without a root the part has no range to show. Put the part inside <RangeCalendar.Root>.',
    );
  }

  return context;
}

/**
 * What a part that renders `RangeCalendar.Root` gives to the root, such as the calendar of a range
 * picker. The root has no prop and no event for it, so a consumer cannot give it.
 */
export interface RangeCalendarHost {
  /**
   * Called when a drag ends on the range that the root already has. The root emits no change for
   * such a drag, but the drag still picks that range.
   */
  onSameRange: (event: PointerEvent) => void;
}

export const RangeCalendarHostContext: InjectionKey<RangeCalendarHost> = Symbol();

/** The host of the root, or `undefined` when no part gives one. */
export function useRangeCalendarHost(): RangeCalendarHost | undefined {
  return inject(RangeCalendarHostContext, undefined);
}

/**
 * The value of a range calendar: the first and the last day. A range in progress has its first
 * day and a `null` last day.
 */
export type RangeValue<Value extends DateValue = DateValue> = [
  start: Value | null,
  end: Value | null,
];

type RangeInput = readonly [DateValue | null, DateValue | null];

export type RangeChangeEventReason = CalendarBaseChangeEventReason | typeof REASONS.drag;
export type RangeChangeEventDetails = VaseUIChangeEventDetails<RangeChangeEventReason>;

/** The first and the last day of a range. The parts compare them by their ISO days. */
export interface DayRange {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

export interface RangeSelectionEmit {
  (event: 'valueChange', value: any, details: RangeChangeEventDetails): void;
  (event: 'update:modelValue', value: any): void;
}

/** The range states of a day. A day of the range has `selected` only when the user can select it. */
export interface RangeDayState {
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  rangeMiddle: boolean;
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
    rangeMiddle: fromStart > 0 && toEnd < 0,
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
 * range at that day. A drag from one day to another makes a range in one change. It ends at the
 * last day toward the pointer that makes a valid range.
 *
 * A range is not valid when it has fewer days than `minDays` or more than `maxDays`, or when it
 * crosses a day that the user cannot select and `allowNonContiguousRanges` is off.
 */
export function useRangeSelection(
  props: RangeCalendarRootProps<DateValue>,
  emit: RangeSelectionEmit,
  host?: RangeCalendarHost,
) {
  const value = useControlled<RangeInput>({
    controlled: () => props.modelValue,
    default: () => props.defaultValue ?? EMPTY_RANGE,
    name: 'RangeCalendar',
    state: 'value',
  });

  const values = computed(() => value.value.filter((end): end is DateValue => end !== null));
  const lastValue = shallowRef<DateValue>();
  watchSyncEffect(() => {
    const first = values.value[0];
    if (first) {
      lastValue.value = first;
    }
  });
  // The start, else the end, else an end of `defaultValue`, else the last value.
  const template = computed(
    () => values.value[0] ?? props.defaultValue?.[0] ?? props.defaultValue?.[1] ?? lastValue.value,
  );
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
  const buttons = new Map<Element, Temporal.PlainDate>();

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

  /**
   * The last day from `anchor` to `date` that ends a valid range with `anchor`, or `null`. A day
   * that the user cannot select ends no range.
   */
  function lastValidEnd(anchor: Temporal.PlainDate, date: Temporal.PlainDate) {
    const step = compareDates(date, anchor) < 0 ? -1 : 1;
    const minDays = props.minDays ?? 1;
    const maxDays = props.maxDays ?? Infinity;
    let end: Temporal.PlainDate | null = null;
    for (let day = anchor, count = 1; count <= maxDays; day = day.add({ days: step }), count += 1) {
      const blocked = isBlocked(day);
      if (blocked && props.allowNonContiguousRanges !== true) {
        break;
      }
      if (!blocked && count >= minDays) {
        end = day;
      }
      if (isSameDay(day, date)) {
        break;
      }
    }
    return end;
  }

  /** The range from `a` to `b`, or `null` when that range is not valid. */
  function rangeBetween(a: Temporal.PlainDate, b: Temporal.PlainDate): DayRange | null {
    const first = a.withCalendar(b.calendarId);
    const end = lastValidEnd(first, b);
    if (!end || !isSameDay(end, b)) {
      return null;
    }
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
  // of another end, else of an end of `defaultValue`. Without one, it is a date in the ISO calendar.
  function createEnds(first: Temporal.PlainDate, second: Temporal.PlainDate | null): RangeValue {
    const [before1, before2] = valueBefore();
    const [current1, current2] = value.value;
    const [default1, default2] = props.defaultValue ?? EMPTY_RANGE;
    const fallback =
      before1 ?? before2 ?? current1 ?? current2 ?? default1 ?? default2 ?? undefined;
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
    emit('update:modelValue', next);
    value.value = next;
    previewDate.value = null;
    return true;
  }

  function commitRange({ start, end }: DayRange, details: RangeChangeEventDetails) {
    const isChanged = commit(createEnds(start, end), details);
    if (isChanged) {
      pending = null;
    }
    return isChanged;
  }

  function start(date: Temporal.PlainDate, details: RangeChangeEventDetails) {
    const before = valueBefore();
    if (commit(createEnds(date, null), details)) {
      pending = { anchor: date, before };
    }
  }

  function press(date: Temporal.PlainDate, details: CalendarBaseChangeEventDetails) {
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
    details: CalendarBaseChangeEventDetails,
    from: Temporal.PlainDate,
  ) {
    const anchor =
      lone.value ?? (extension && isSameDay(extension.last, from) ? extension.anchor : from);
    // A key that gives a range that is not valid changes nothing, and the next key keeps the anchor.
    extension = { anchor, last: date };
    const range = rangeBetween(anchor, date);
    if (range) {
      commitRange(range, details);
    }
  }

  function preview(date: Temporal.PlainDate) {
    if (lone.value && props.readOnly !== true && !isBlocked(date)) {
      previewDate.value = date;
    }
  }

  function cancel(event: KeyboardEvent) {
    if (drag.value) {
      drag.value = null;
      // The release after Escape still clicks the button that holds the pointer.
      suppressClick = true;
      return true;
    }
    const day = lone.value;
    if (!day || props.readOnly === true) {
      return false;
    }
    extension = null;
    const [first, second] =
      pending && isSameDay(pending.anchor, day) ? pending.before : EMPTY_RANGE;
    // A listener that cancels the change keeps the range in progress, so the next Escape puts
    // back the same range.
    if (commit([first, second], createChangeEventDetails(REASONS.keyboard, event))) {
      pending = null;
    }
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
    if (!dragged) {
      return;
    }
    const current = lastValidEnd(dragged.anchor, date) ?? dragged.anchor;
    const moved = dragged.moved || !isSameDay(date, dragged.anchor);
    if (moved !== dragged.moved || !isSameDay(current, dragged.current)) {
      drag.value = { ...dragged, current, moved };
    }
  }

  function endDrag(date: Temporal.PlainDate | null, event: PointerEvent) {
    if (date) {
      dragTo(date);
    }
    const dragged = drag.value;
    drag.value = null;
    if (!dragged?.moved) {
      return;
    }
    suppressClick = true;
    const range = rangeBetween(dragged.anchor, dragged.current);
    if (range) {
      const details = createChangeEventDetails(REASONS.drag, event);
      // The drag picks the range that the value already has, so the host learns of it.
      if (!commitRange(range, details) && !details.isCanceled) {
        host?.onSameRange(event);
      }
    }
  }

  function dayAtPoint(from: Element, clientX: number, clientY: number) {
    const root = from.getRootNode() as Document | ShadowRoot;
    for (
      let element = root.elementFromPoint(clientX, clientY);
      element;
      element = element.parentElement
    ) {
      const date = buttons.get(element);
      if (date) {
        return date;
      }
    }
    return null;
  }

  return {
    values,
    template,
    multiselectable: computed(() => true),
    isSelected,
    press,
    extend,
    displayRange,
    selecting: computed(() => drag.value?.moved === true || lone.value !== null),
    preview,
    cancel,
    beginDrag,
    isDragging: (pointerId: number) => drag.value?.pointerId === pointerId,
    dragTo,
    endDrag,
    cancelDrag() {
      drag.value = null;
    },
    dayAtPoint,
    registerButton(element: Element, date: Temporal.PlainDate) {
      buttons.set(element, date);
      return () => {
        buttons.delete(element);
      };
    },
    takeClickSuppression(event: MouseEvent) {
      const isAfterDrag = suppressClick && event.detail > 0;
      if (isAfterDrag) {
        suppressClick = false;
      }
      return isAfterDrag;
    },
  };
}

export interface RangeCalendarDayContext {
  day: Readonly<Ref<Temporal.PlainDate>>;
  state: ComputedRef<RangeCalendarDayState>;
}

export const RangeCalendarDayContext: InjectionKey<RangeCalendarDayContext> = Symbol();

export function useRangeCalendarDayContext(): RangeCalendarDayContext {
  const context = inject(RangeCalendarDayContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <RangeCalendar.DayButton> must be inside <RangeCalendar.Day>. Without a day the button has no date to select. Put the button inside <RangeCalendar.Day>.',
    );
  }

  return context;
}

// The default mapping writes `data-rangestart`, `data-rangeend` and `data-rangemiddle`.
export const rangeDayStateAttributesMapping: StateAttributesMapping<RangeCalendarDayState> = {
  ...dayStateAttributesMapping,
  rangeStart: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeStart]: '' } : null),
  rangeEnd: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeEnd]: '' } : null),
  rangeMiddle: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeMiddle]: '' } : null),
};
