import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { EMPTY_ARRAY } from '../../../common/empty';
import { useControlled } from '../../../common/useControlled';
import { isSameDay, withDate } from '../temporal';
import type { DateValue } from '../temporal';
import type { CalendarChangeEventDetails } from './calendarProps';

/**
 * How a calendar selects days. `useCalendarRoot` takes one. A selection owns the value of the
 * calendar: its model, its events and the rules of a press.
 */
export interface CalendarSelection {
  /** The values of the selection: none, one, or each value of a list. */
  values: ComputedRef<readonly DateValue[]>;
  /**
   * Whether the grid selects more than one day. The grid then has `aria-multiselectable`, and
   * Shift with an arrow key calls `extend` and does not move a month or a year.
   */
  multiselectable: ComputedRef<boolean>;
  /** Whether `date` is in the selection. It reads the selection, so a `computed` follows it. */
  isSelected: (date: Temporal.PlainDate) => boolean;
  /** A press on a day that the user can select. */
  press: (date: Temporal.PlainDate, details: CalendarChangeEventDetails) => void;
  /**
   * The move of the focus by Shift with an arrow key to a day that the user can select. `from` is
   * the day that had the focus before the key.
   */
  extend: (
    date: Temporal.PlainDate,
    details: CalendarChangeEventDetails,
    from: Temporal.PlainDate,
  ) => void;
}

type DayValueInput = DateValue | readonly DateValue[] | null | undefined;

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

function isList(value: DateValue | readonly DateValue[]): value is readonly DateValue[] {
  return Array.isArray(value);
}

function toValues(value: DayValueInput): readonly DateValue[] {
  if (value === null || value === undefined) {
    return EMPTY_ARRAY;
  }
  return isList(value) ? value : [value];
}

/**
 * The selection of one day, or of a list of days with `multiple`. A press on the selected day
 * changes nothing in a single selection, and removes the day from a list down to `minDays`. A press
 * past `maxDays` changes nothing.
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
    return values.value.some((item) => isSameDay(item, date));
  }

  // A new value takes the kind, the time, the zone and the calendar of a value that the calendar
  // has or that its `defaultValue` has. Without one, it is a date in the ISO calendar.
  function createValue(date: Temporal.PlainDate): DateValue {
    const like = values.value[0] ?? toValues(props.defaultValue)[0];
    return like ? withDate(like, date) : date.withCalendar('iso8601');
  }

  function commit(next: DateValue | DateValue[], details: CalendarChangeEventDetails) {
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
        values.value.filter((item) => !isSameDay(item, date)),
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
