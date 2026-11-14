import { computed, nextTick, onMounted, shallowRef, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { useControlled } from '../../../common/useControlled';
import { useFormatLocale } from '../../../utils/useFormatLocale';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { useDirection } from '../../direction-context/DirectionContext';
import { REASONS } from '../../reasons';
import { displayCalendar } from '../displayCalendar';
import { weekInfo } from '../format';
import { isKind, isSameDay, toInputText, toPlainDate, today } from '../temporal';
import type { DateValue, DayOfWeek } from '../temporal';
import type { CalendarBaseProps, CalendarChangeEventDetails } from './calendarProps';
import { assertModifierNames, canFocus, canSelect, getDayState } from './dayState';
import type { DayRules } from './dayState';
import type { CalendarSelection } from './daySelection';
import { findKeyTarget, getKeyAction, getTabStop } from './focusTarget';
import { formatText } from './formatText';
import { getMonthPage, isInMonth, weekdaysFrom } from './monthGrid';
import type { CalendarPage } from './monthGrid';

export interface CalendarRootEmit {
  (event: 'monthChange', month: Temporal.PlainYearMonth, details: CalendarChangeEventDetails): void;
  (event: 'update:month', month: Temporal.PlainYearMonth): void;
  (event: 'focusedDateChange', date: Temporal.PlainDate, details: CalendarChangeEventDetails): void;
  (event: 'update:focusedDate', date: Temporal.PlainDate): void;
}

export interface UseCalendarRootOptions {
  /** The name of the root part in the messages. */
  part: string;
  props: CalendarBaseProps;
  emit: CalendarRootEmit;
  selection: CalendarSelection;
}

/** What the root gives to its parts and to its own element. */
export interface CalendarRootController {
  /** The calendar of the dates of the grid. `gregory` is `iso8601` here: the dates are the same. */
  calendar: ComputedRef<string>;
  /** The locale for `Intl`. It is `en-US` until the root is mounted, when the consumer gives none. */
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  /** The pages of the grid. */
  pages: ComputedRef<CalendarPage[]>;
  /** The days of the week in the order of the grid. */
  weekdays: ComputedRef<DayOfWeek[]>;
  weekend: ComputedRef<readonly DayOfWeek[]>;
  multiselectable: ComputedRef<boolean>;
  /** The day that has the tab stop, or `null` when no day can take focus. */
  tabStop: ComputedRef<Temporal.PlainDate | null>;
  /** The rules that give the state of a day with `getDayState`. */
  rules: ComputedRef<DayRules>;
  /** The name of the visible month, for the `aria-label` of the root. */
  label: ComputedRef<string>;
  pressDay: (date: Temporal.PlainDate, event: MouseEvent) => void;
  onDayFocus: (date: Temporal.PlainDate, event: FocusEvent) => void;
  onDayKeydown: (date: Temporal.PlainDate, event: KeyboardEvent) => void;
  /** Gives the element of a day to the root, so that the root can focus it. It returns the undo. */
  registerDay: (date: Temporal.PlainDate, element: HTMLElement) => () => void;
  /** Focuses `date`, and shows its month. With no date, it focuses the day that has the tab stop. */
  focus: (date?: DateValue) => void;
}

/**
 * The state and the keys of a calendar root. A root calls it in `setup` after `assertTemporal`.
 * The root owns the focused day and the month of the page. The pages, the tab stop and the keys
 * derive from them and from the selection.
 */
export function useCalendarRoot({
  part,
  props,
  emit,
  selection,
}: UseCalendarRootOptions): CalendarRootController {
  const formatLocale = useFormatLocale(() => props.locale);
  const direction = useDirection();

  // The dates of an ISO grid and of a Gregorian grid are the same, so the dates of the grid and
  // the months that the root emits are ISO and not Gregorian. The text still follows the locale.
  const calendar = computed(() => {
    const id = displayCalendar(props.calendar, selection.values.value[0], formatLocale.value);
    return id === 'gregory' ? 'iso8601' : id;
  });

  const weekData = computed(() => weekInfo(formatLocale.value));
  const firstDay = computed(() => props.firstDayOfWeek ?? weekData.value.firstDay);
  const weekdays = computed(() => weekdaysFrom(firstDay.value));
  const weekend = computed(() => weekData.value.weekend);

  const timeZone = computed(() => {
    const first = selection.values.value[0];
    return (
      props.timeZone ?? (first && isKind(first, 'zonedDateTime') ? first.timeZoneId : undefined)
    );
  });
  // The clock is read in `setup` and when the month changes, so a page that stays open for days
  // gets the right day when the user moves on.
  const clockDay = shallowRef(today(timeZone.value));
  const todayDate = computed(() =>
    props.today === undefined ? clockDay.value : toPlainDate(props.today),
  );

  function toGridDate(date: DateValue | Temporal.PlainYearMonth) {
    return toPlainDate(date).withCalendar(calendar.value);
  }

  const initialMonth = toGridDate(
    props.focusedDate ?? props.defaultFocusedDate ?? selection.values.value[0] ?? todayDate.value,
  ).toPlainYearMonth();

  const [monthState, setMonthState] = useControlled<Temporal.PlainYearMonth>({
    controlled: () => props.month,
    default: () => props.defaultMonth ?? initialMonth,
    name: 'Calendar',
    state: 'month',
  });
  const visibleMonth = computed(() => toGridDate(monthState.value).toPlainYearMonth());

  const [focusedDateState, setFocusedDateState] = useControlled<Temporal.PlainDate | null>({
    controlled: () => props.focusedDate,
    default: () => props.defaultFocusedDate ?? null,
    name: 'Calendar',
    state: 'focusedDate',
  });

  watch(visibleMonth, () => {
    clockDay.value = today(timeZone.value);
  });

  const pages = computed(() => [getMonthPage(visibleMonth.value, firstDay.value)]);

  assertModifierNames(part, props.modifiers);
  if (process.env.NODE_ENV !== 'production') {
    watch(
      () => props.modifiers,
      (modifiers) => {
        assertModifierNames(part, modifiers);
      },
    );
  }

  const rules = computed<DayRules>(() => ({
    today: todayDate.value,
    weekend: weekend.value,
    disabled: props.disabled === true,
    minDate: props.minDate,
    maxDate: props.maxDate,
    disabledDates: props.disabledDates,
    unavailableDates: props.unavailableDates,
    hiddenDates: props.hiddenDates,
    modifiers: props.modifiers,
    isSelected: selection.isSelected,
  }));

  // A day outside the page is a day of its own month here, so only `hiddenDates` hides it.
  function getStateOfDate(date: Temporal.PlainDate) {
    return getDayState(date, date.toPlainYearMonth(), rules.value);
  }

  const tabStop = computed(() =>
    getTabStop({
      days: pages.value.flatMap((page) =>
        page.weeks.flatMap((week) =>
          week.days.filter((day) => canFocus(getDayState(day, page.yearMonth, rules.value))),
        ),
      ),
      focusedDate: focusedDateState.value,
      isSelected: selection.isSelected,
      today: todayDate.value,
    }),
  );

  const label = computed(() =>
    formatText(visibleMonth.value, { month: 'long', year: 'numeric' }, formatLocale.value),
  );

  function setMonth(month: Temporal.PlainYearMonth, details: CalendarChangeEventDetails) {
    emit('monthChange', month, details);
    if (details.isCanceled) {
      return false;
    }
    emit('update:month', month);
    setMonthState(month);
    return true;
  }

  function setFocusedDate(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
    emit('focusedDateChange', date, details);
    if (details.isCanceled) {
      return false;
    }
    emit('update:focusedDate', date);
    setFocusedDateState(date);
    return true;
  }

  const dayElements = new Map<string, HTMLElement>();

  function registerDay(date: Temporal.PlainDate, element: HTMLElement) {
    const key = toInputText(date, false);
    dayElements.set(key, element);
    return () => {
      if (dayElements.get(key) === element) {
        dayElements.delete(key);
      }
    };
  }

  // The element of a day that the page shows now exists after the next flush.
  function focusDayElement(date: Temporal.PlainDate) {
    void nextTick().then(() => {
      dayElements.get(toInputText(date, false))?.focus();
    });
  }

  // `createDetails` makes a new object for each event, because `cancel()` belongs to one event.
  function moveFocus(date: Temporal.PlainDate, createDetails: () => CalendarChangeEventDetails) {
    const isVisible = pages.value.some((page) => isInMonth(date, page.yearMonth));
    if (!isVisible && !setMonth(date.toPlainYearMonth(), createDetails())) {
      return false;
    }
    if (!setFocusedDate(date, createDetails())) {
      return false;
    }
    focusDayElement(date);
    return true;
  }

  const canChange = () => props.readOnly !== true;

  function pressDay(date: Temporal.PlainDate, event: MouseEvent) {
    if (canChange() && canSelect(getStateOfDate(date))) {
      selection.press(date, createChangeEventDetails(REASONS.dayPress, event));
    }
  }

  function onDayFocus(date: Temporal.PlainDate, event: FocusEvent) {
    const focusedDate = focusedDateState.value;
    if (!focusedDate || !isSameDay(focusedDate, date)) {
      setFocusedDate(date, createChangeEventDetails(REASONS.none, event));
    }
  }

  function onDayKeydown(date: Temporal.PlainDate, event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const action = getKeyAction(event.key, event.shiftKey, {
      isRtl: direction.value === 'rtl',
      canExtend: selection.multiselectable.value,
    });
    if (!action) {
      return;
    }
    event.preventDefault();
    const target = findKeyTarget(date, action.move, {
      firstDay: firstDay.value,
      canFocus: (candidate) => canFocus(getStateOfDate(candidate)),
      min: props.minDate && toGridDate(props.minDate),
      max: props.maxDate && toGridDate(props.maxDate),
    });
    if (!target) {
      return;
    }
    const hasMoved = moveFocus(target, () => createChangeEventDetails(REASONS.keyboard, event));
    if (hasMoved && action.extend && canChange() && canSelect(getStateOfDate(target))) {
      selection.extend(target, createChangeEventDetails(REASONS.keyboard, event));
    }
  }

  function focus(date?: DateValue) {
    if (date === undefined) {
      if (tabStop.value) {
        focusDayElement(tabStop.value);
      }
      return;
    }
    const target = toGridDate(date);
    if (canFocus(getStateOfDate(target))) {
      moveFocus(target, () => createChangeEventDetails(REASONS.none));
    }
  }

  onMounted(() => {
    if (props.autoFocus) {
      focus();
    }
  });

  return {
    calendar,
    locale: formatLocale,
    pages,
    weekdays,
    weekend,
    multiselectable: selection.multiselectable,
    tabStop,
    rules,
    label,
    pressDay,
    onDayFocus,
    onDayKeydown,
    registerDay,
    focus,
  };
}
