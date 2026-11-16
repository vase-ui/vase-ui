import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { EMPTY_ARRAY } from '../../../common/empty';
import { useControlled } from '../../../common/useControlled';
import { compareDates, withDate } from '../temporal';
import type { CalendarChangeEventDetails, CalendarValue } from './calendarProps';

/**
 * How a calendar selects days. `useCalendarRoot` takes one. A selection owns the value of the
 * calendar: its model, its events and the rules of a press.
 */
export interface CalendarSelection {
  /** The values of the selection: none, one, or each value of a list. */
  values: ComputedRef<readonly CalendarValue[]>;
  /**
   * Whether the grid selects more than one day. The grid then has `aria-multiselectable`, and
   * Shift with an arrow key calls `extend` and does not move a month or a year.
   */
  multiselectable: ComputedRef<boolean>;
  /** Whether `date` is in the selection. It reads the selection, so a `computed` follows it. */
  isSelected: (date: Temporal.PlainDate) => boolean;
  /** A press on a day that the user can select. */
  press: (date: Temporal.PlainDate, details: CalendarChangeEventDetails) => void;
  /** The move of the focus by Shift with an arrow key to a day that the user can select. */
  extend: (date: Temporal.PlainDate, details: CalendarChangeEventDetails) => void;
}

type DayValueInput = CalendarValue | readonly CalendarValue[] | null | undefined;

export interface DaySelectionProps {
  value?: DayValueInput;
  defaultValue?: DayValueInput;
  multiple?: boolean | undefined;
  minDays?: number | undefined;
  maxDays?: number | undefined;
}

export interface DaySelectionEmit {
  (event: 'valueChange', value: any, details: CalendarChangeEventDetails): void;
  (event: 'update:value', value: any): void;
}

function isList(
  value: CalendarValue | readonly CalendarValue[],
): value is readonly CalendarValue[] {
  return Array.isArray(value);
}

// A year and month is the day that it starts with.
function isOnDay(value: CalendarValue, date: Temporal.PlainDate): boolean {
  return compareDates(value, date) === 0;
}

function toValues(value: DayValueInput): readonly CalendarValue[] {
  if (value === null || value === undefined) {
    return EMPTY_ARRAY;
  }
  return isList(value) ? value : [value];
}

/**
 * The selection of one day, or of a list of days with `multiple`. A press on the selected day
 * changes nothing in a single selection, and removes the day from a list down to `minDays`. A press
 * past `maxDays` changes nothing.
 *
 * A value that is a year and month is selected by its first day, so a press on a month is a press on
 * its first day. The new value is then a year and month.
 */
export function useDaySelection(
  props: DaySelectionProps,
  emit: DaySelectionEmit,
): CalendarSelection {
  const [value, setValue] = useControlled<DayValueInput>({
    controlled: () => props.value,
    default: () => props.defaultValue ?? (props.multiple ? EMPTY_ARRAY : null),
    name: 'Calendar',
    state: 'value',
  });

  const values = computed(() => toValues(value.value));
  const multiselectable = computed(() => props.multiple === true);

  function isSelected(date: Temporal.PlainDate) {
    return values.value.some((item) => isOnDay(item, date));
  }

  // A new value takes the kind, the time, the zone and the calendar of a value that the calendar
  // has or that its `defaultValue` has. Without one, it is a date in the ISO calendar.
  function createValue(date: Temporal.PlainDate): CalendarValue {
    const like = values.value[0] ?? toValues(props.defaultValue)[0];
    return like ? withDate(like, date) : date.withCalendar('iso8601');
  }

  function commit(next: CalendarValue | CalendarValue[], details: CalendarChangeEventDetails) {
    emit('valueChange', next, details);
    if (details.isCanceled) {
      return;
    }
    emit('update:value', next);
    setValue(next);
  }

  function add(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
    if (values.value.length < (props.maxDays ?? Infinity)) {
      commit([...values.value, createValue(date)], details);
    }
  }

  function press(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
    if (!props.multiple) {
      if (!isSelected(date)) {
        commit(createValue(date), details);
      }
    } else if (!isSelected(date)) {
      add(date, details);
    } else if (values.value.length > (props.minDays ?? 0)) {
      commit(
        values.value.filter((item) => !isOnDay(item, date)),
        details,
      );
    }
  }

  function extend(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
    if (!isSelected(date)) {
      add(date, details);
    }
  }

  return { values, multiselectable, isSelected, press, extend };
}
