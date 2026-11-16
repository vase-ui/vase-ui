import { computed, nextTick, onMounted, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { ownerDocument } from '../../../common/owner';
import { activeElement } from '../../../common/shadowDom';
import { useControlled } from '../../../common/useControlled';
import { useFormatLocale } from '../../../utils/useFormatLocale';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { useDirection } from '../../direction-context/DirectionContext';
import { REASONS } from '../../reasons';
import { displayCalendar } from '../displayCalendar';
import { weekInfo } from '../format';
import { compareDates, isKind, isSameDay, toInputText, toPlainDate, today } from '../temporal';
import type { DateValue, DayOfWeek } from '../temporal';
import type { CalendarBaseProps, CalendarChangeEventDetails } from './calendarProps';
import { assertModifierNames, canFocus, canSelect, getDayState, ownsDay } from './dayState';
import type { DayRules } from './dayState';
import type { CalendarSelection } from './daySelection';
import { findKeyTarget, getKeyAction, getTabStop } from './focusTarget';
import { formatPages } from './formatText';
import { getMonthPage, startOfWeek } from './monthGrid';
import type { CalendarPage, CalendarPageWeek } from './monthGrid';
import { usePageTransition } from './usePageTransition';
import type { NavigationDirection } from './usePageTransition';
import { alignPageStart, getBroadcastPage, getDurationPage, getWeekNumber } from './weeks';
import type { VisibleDuration } from './weeks';

export interface CalendarRootEmit {
  (event: 'monthChange', month: Temporal.PlainYearMonth, details: CalendarChangeEventDetails): void;
  (event: 'update:month', month: Temporal.PlainYearMonth): void;
  (event: 'focusedDateChange', date: Temporal.PlainDate, details: CalendarChangeEventDetails): void;
  (event: 'update:focusedDate', date: Temporal.PlainDate): void;
}

/** The first day of the page of a duration, and the month of the root for that page. */
interface DurationStart {
  day: Temporal.PlainDate;
  month: Temporal.PlainYearMonth;
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
  /** The locale for `Intl`. It is `en-US` until the root is mounted, when the consumer gives none. */
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  /** The pages of the grid. */
  pages: ComputedRef<CalendarPage[]>;
  /** The pages of the grid, and the pages that left and stay until their animations end. */
  renderedPages: ComputedRef<CalendarPage[]>;
  /** Whether the page left the grid and stays until its animations end. */
  isLeaving: (page: CalendarPage) => boolean;
  /** A page that left calls it when its animations end. The page then goes. */
  finishLeaving: (page: CalendarPage) => void;
  /** The days of the week in the order of the grid. */
  weekdays: ComputedRef<DayOfWeek[]>;
  weekend: ComputedRef<readonly DayOfWeek[]>;
  multiselectable: ComputedRef<boolean>;
  /** The day that has the tab stop, or `null` when no day can take focus. */
  tabStop: ComputedRef<Temporal.PlainDate | null>;
  /** The rules that give the state of a day with `getDayState`. */
  rules: ComputedRef<DayRules>;
  /** The name of the visible pages, for the `aria-label` of the root. */
  label: ComputedRef<string>;
  /** The side of the last change of the page. */
  navigationDirection: Readonly<Ref<NavigationDirection>>;
  /** What one press of a navigation button moves: months, weeks or days. */
  navigationStep: ComputedRef<{ unit: 'months' | 'weeks' | 'days'; count: number }>;
  /** Whether `minDate` allows a page before the first one. */
  canPrevious: ComputedRef<boolean>;
  /** Whether `maxDate` allows a page after the last one. */
  canNext: ComputedRef<boolean>;
  /** The month of `minDate` and the month of `maxDate`. */
  monthLimits: ComputedRef<{
    min: Temporal.PlainYearMonth | undefined;
    max: Temporal.PlainYearMonth | undefined;
  }>;
  /**
   * Moves the pages by one step: by one month, by `numberOfMonths` months with `pagedNavigation`,
   * or by the duration. It returns `true` when another step in the same direction is possible.
   */
  navigate: (step: 1 | -1, event?: Event) => boolean;
  /**
   * Makes `month` the month of the page at `pageIndex`. The pages then obey `minDate` and
   * `maxDate`, as for each other move, so the page can show another month.
   */
  showMonth: (month: Temporal.PlainYearMonth, pageIndex: number, event?: Event) => void;
  /** The number of the week, by `isoWeek` and `firstWeekContainsDate`. */
  getWeekNumber: (week: CalendarPageWeek) => number;
  /** The day in the calendar of the grid. */
  toGridDate: (date: DateValue | Temporal.PlainYearMonth) => Temporal.PlainDate;
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
  const name = part.replace(/\.Root$/, '');

  // The dates of an ISO grid and of a Gregorian grid are the same, so the dates of the grid and
  // the months that the root emits are ISO and not Gregorian. The text still follows the locale.
  const calendar = computed(() => {
    const id = displayCalendar(props.calendar, selection.values.value[0], formatLocale.value);
    return id === 'gregory' ? 'iso8601' : id;
  });

  function assertBroadcastCalendar() {
    if (props.broadcastCalendar === true && calendar.value !== 'iso8601') {
      throw new Error(
        `Vase UI: <${part}> has \`broadcastCalendar\` and shows the calendar \`${calendar.value}\`. ` +
          'The broadcast calendar is made of Gregorian months, so no other calendar can show it. ' +
          'Remove `broadcastCalendar`, or set `calendar="gregory"`.',
      );
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    assertBroadcastCalendar();
    watch([() => props.broadcastCalendar, calendar], assertBroadcastCalendar);
  }

  const weekData = computed(() => weekInfo(formatLocale.value));
  const firstDay = computed<DayOfWeek>(() =>
    props.isoWeek === true || props.broadcastCalendar === true
      ? 1
      : (props.firstDayOfWeek ?? weekData.value.firstDay),
  );
  const minimalDays = computed(() =>
    props.isoWeek === true ? 4 : (props.firstWeekContainsDate ?? (firstDay.value === 1 ? 4 : 1)),
  );
  const weekend = computed(() => weekData.value.weekend);
  const monthCount = computed(() => Math.max(1, Math.floor(props.numberOfMonths ?? 1)));
  // A duration has at least one week or one day.
  const duration = computed<VisibleDuration | undefined>(() => {
    const visible = props.visibleDuration;
    if (!visible) {
      return undefined;
    }
    return 'weeks' in visible
      ? { weeks: Math.max(1, Math.floor(visible.weeks)) }
      : { days: Math.max(1, Math.floor(visible.days)) };
  });

  const timeZone = computed(() => {
    const first = selection.values.value[0];
    return (
      props.timeZone ?? (first && isKind(first, 'zonedDateTime') ? first.timeZoneId : undefined)
    );
  });
  // The clock is read in `setup`, and again when the first page or the time zone changes. A page
  // that stays open for days then gets the right day when the user moves on.
  const clockDay = shallowRef(today(timeZone.value));
  const todayDate = computed(() =>
    props.today === undefined ? clockDay.value : toPlainDate(props.today),
  );

  function toGridDate(date: DateValue | Temporal.PlainYearMonth) {
    return toPlainDate(date).withCalendar(calendar.value);
  }

  // The root picks the first page from this day until the month changes. It is a day and not a
  // month, because the calendar of the grid can change after the mount: the locale of the runtime
  // replaces `en-US`, and its calendar can have other months.
  const initialDate = toPlainDate(
    props.focusedDate ?? props.defaultFocusedDate ?? selection.values.value[0] ?? todayDate.value,
  );

  const monthLimits = computed(() => ({
    min: props.minDate && monthOfDate(toGridDate(props.minDate)),
    max: props.maxDate && monthOfDate(toGridDate(props.maxDate)),
  }));

  const [monthState, setMonthState] = useControlled<Temporal.PlainYearMonth | undefined>({
    controlled: () => props.month,
    default: () => props.defaultMonth,
    name,
    state: 'month',
  });
  // The limits apply only to a first page that the root picks. The root shows a month of the
  // consumer as it is: a change of a controlled `month` needs an event, and the mount emits none.
  const visibleMonth = computed(() =>
    monthState.value
      ? toGridDate(monthState.value).toPlainYearMonth()
      : clampMonth(toGridDate(initialDate).toPlainYearMonth()),
  );

  const [focusedDateState, setFocusedDateState] = useControlled<Temporal.PlainDate | null>({
    controlled: () => props.focusedDate,
    default: () => props.defaultFocusedDate ?? null,
    name,
    state: 'focusedDate',
  });

  // The first day of the page of a duration applies while the root has its month: a month that the
  // consumer sets moves the page to that month. A move to a page of another month waits in
  // `requestedDurationStart` until the root has that month. The page then changes one time, and a
  // consumer that keeps its `month` keeps the page.
  const durationStart = shallowRef<DurationStart | null>(null);
  const requestedDurationStart = shallowRef<DurationStart | null>(null);

  function isOfVisibleMonth(start: DurationStart | null): start is DurationStart {
    return start !== null && toGridDate(start.month).toPlainYearMonth().equals(visibleMonth.value);
  }

  const pageStart = computed(() => {
    const visible = duration.value;
    if (!visible) {
      return null;
    }
    const start = [requestedDurationStart.value, durationStart.value].find(isOfVisibleMonth);
    if (start) {
      return toGridDate(start.day);
    }
    const anchor = monthState.value
      ? visibleMonth.value.toPlainDate({ day: 1 })
      : toGridDate(initialDate);
    const first = alignPageStart(anchor, visible, firstDay.value, 'start');
    return monthState.value ? first : clampPageStart(first, visible);
  });

  function createMonthPage(month: Temporal.PlainYearMonth) {
    return props.broadcastCalendar === true
      ? getBroadcastPage(month, props.fixedWeeks === true)
      : getMonthPage(month, firstDay.value, props.fixedWeeks === true);
  }

  const pages = computed(() => {
    const visible = duration.value;
    return visible && pageStart.value
      ? [getDurationPage(pageStart.value, visible, visibleMonth.value)]
      : Array.from({ length: monthCount.value }, (_, index) =>
          createMonthPage(visibleMonth.value.add({ months: index })),
        );
  });
  const weekdays = computed(() => pages.value[0]?.weekdays ?? []);

  watch([() => pages.value[0]?.first.toString(), timeZone], () => {
    clockDay.value = today(timeZone.value);
  });

  const { navigationDirection, renderedPages, isLeaving, finishLeaving } = usePageTransition(
    pages,
    computed(() => `${calendar.value}|${firstDay.value}`),
  );

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
    showOutsideDays: props.showOutsideDays ?? props.broadcastCalendar === true,
    pages: pages.value,
    isSelected: selection.isSelected,
  }));

  // A day with no page is not outside a month, so a key can go to a day of another month.
  function getStateOfDate(date: Temporal.PlainDate) {
    return getDayState(date, null, rules.value);
  }

  const tabStop = computed(() =>
    getTabStop({
      days: pages.value.flatMap((page) =>
        page.weeks.flatMap((week) =>
          week.days.filter((day) => canFocus(getDayState(day, page, rules.value))),
        ),
      ),
      focusedDate: focusedDateState.value,
      isSelected: selection.isSelected,
      today: todayDate.value,
    }),
  );

  const label = computed(() => formatPages(pages.value, formatLocale.value));

  function setMonth(month: Temporal.PlainYearMonth, details: CalendarChangeEventDetails) {
    emit('monthChange', month, details);
    if (details.isCanceled) {
      return false;
    }
    emit('update:month', month);
    setMonthState(month);
    return true;
  }

  // A page of a duration moves to the month of its first day: that month is the month of the root.
  function setPageStart(
    day: Temporal.PlainDate,
    details: CalendarChangeEventDetails,
    month = day.toPlainYearMonth(),
  ) {
    const start = { day, month };
    if (isOfVisibleMonth(start)) {
      durationStart.value = start;
      requestedDurationStart.value = null;
      return true;
    }
    // The page that waited for the month of the root is the page that the root shows now.
    if (isOfVisibleMonth(requestedDurationStart.value)) {
      durationStart.value = requestedDurationStart.value;
    }
    requestedDurationStart.value = start;
    if (!setMonth(month, details)) {
      requestedDurationStart.value = null;
      return false;
    }
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

  // A broadcast month ends on the Sunday before the Monday of the week that holds the first day of
  // the next month. The days from that Monday belong to the next month.
  function monthOfDate(date: Temporal.PlainDate) {
    const month = date.toPlainYearMonth();
    if (props.broadcastCalendar !== true) {
      return month;
    }
    const next = month.add({ months: 1 });
    return compareDates(date, startOfWeek(next.toPlainDate({ day: 1 }), 1)) >= 0 ? next : month;
  }

  // Shows the page that holds `date`. A date after the page starts the new page, and a date before
  // the page ends it, so the page moves the way that the date does.
  function showDate(date: Temporal.PlainDate, createDetails: () => CalendarChangeEventDetails) {
    const visible = duration.value;
    if (visible && pageStart.value) {
      const edge = compareDates(date, pageStart.value) < 0 ? 'end' : 'start';
      return setPageStart(
        clampPageStart(alignPageStart(date, visible, firstDay.value, edge), visible),
        createDetails(),
      );
    }
    const month = monthOfDate(date);
    const first = pages.value[0];
    const isBefore = first !== undefined && compareDates(date, first.first) < 0;
    return setMonth(
      clampMonth(isBefore ? month.subtract({ months: monthCount.value - 1 }) : month),
      createDetails(),
    );
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

  function isShown(date: Temporal.PlainDate) {
    return pages.value.some(
      (page) =>
        compareDates(date, page.start) >= 0 &&
        compareDates(date, page.end) <= 0 &&
        !getDayState(date, page, rules.value).hidden,
    );
  }

  function isOwned(date: Temporal.PlainDate) {
    return pages.value.some((page) => ownsDay(page, date));
  }

  // `createDetails` makes a new object for each event, because `cancel()` belongs to one event.
  function moveFocus(date: Temporal.PlainDate, createDetails: () => CalendarChangeEventDetails) {
    if (!isShown(date) && !showDate(date, createDetails)) {
      return false;
    }
    if (!setFocusedDate(date, createDetails())) {
      return false;
    }
    focusDayElement(date);
    return true;
  }

  function clampDate(date: Temporal.PlainDate) {
    const min = props.minDate && toGridDate(props.minDate);
    const max = props.maxDate && toGridDate(props.maxDate);
    if (min && compareDates(date, min) < 0) {
      return min;
    }
    return max && compareDates(date, max) > 0 ? max : date;
  }

  function isDayElement(element: Element | null) {
    return [...dayElements.values()].some((dayElement) => dayElement === element);
  }

  // An element in an `inert` subtree cannot keep the focus. The browser thus moves the focus to
  // `<body>` when the page of the day that has the focus leaves.
  // The root decides after the flush, because a consumer can give the new month in that flush. A
  // consumer can also give the focus to another element then, and that focus stays.
  // The root focuses the tab stop only when the tab stop is the focused day, or when the day that
  // had the focus left the grid. Else the focus event would write the tab stop to the consumer in
  // place of the day that the consumer wrote.
  function keepFocusInGrid() {
    const [someDayElement] = dayElements.values();
    const doc = ownerDocument(someDayElement);
    const focused = activeElement(doc);
    if (!isDayElement(focused)) {
      return;
    }
    void nextTick().then(() => {
      const active = activeElement(doc);
      if (active !== focused && active !== doc.body && active !== null) {
        return;
      }
      const stop = tabStop.value;
      const focusedDateHasStop = stop && props.focusedDate && isSameDay(stop, props.focusedDate);
      if (focusedDateHasStop || !isDayElement(active)) {
        focus();
      }
    });
  }

  // The watchers compare a text, because a consumer can give a new object for the same day or the
  // same month in each render.
  watch(
    () => props.focusedDate && toInputText(props.focusedDate, false),
    () => {
      if (props.focusedDate) {
        const date = clampDate(toGridDate(props.focusedDate));
        if (!isShown(date) && !isOwned(date)) {
          showDate(date, () => createChangeEventDetails(REASONS.none));
        }
      }
      keepFocusInGrid();
    },
  );
  watch(() => props.month?.toString(), keepFocusInGrid);

  const canChange = () => props.readOnly !== true;

  function pressDay(date: Temporal.PlainDate, event: MouseEvent) {
    const state = getStateOfDate(date);
    if (canChange() && canSelect(state)) {
      selection.press(date, createChangeEventDetails(REASONS.dayPress, event));
    }
    // A day that no page owns shows as an outside day. A press on it shows its page.
    if (canFocus(state) && !isOwned(date)) {
      showDate(date, () => createChangeEventDetails(REASONS.dayPress, event));
      focusDayElement(date);
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
      selection.extend(target, createChangeEventDetails(REASONS.keyboard, event), date);
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

  const navigationStep = computed(() => {
    const visible = duration.value;
    if (visible) {
      return 'weeks' in visible
        ? { unit: 'weeks' as const, count: visible.weeks }
        : { unit: 'days' as const, count: visible.days };
    }
    return {
      unit: 'months' as const,
      count: props.pagedNavigation === true ? monthCount.value : 1,
    };
  });

  const canPrevious = computed(() => {
    const first = pages.value[0];
    return (
      first !== undefined &&
      (props.minDate === undefined || compareDates(first.first, props.minDate) > 0)
    );
  });
  const canNext = computed(() => {
    const last = pages.value.at(-1);
    return (
      last !== undefined &&
      (props.maxDate === undefined || compareDates(last.last, props.maxDate) < 0)
    );
  });

  // When fewer months than the pages are between the limits, `maxDate` wins, as in React Aria's
  // calendar. The first pages then start before `minDate`.
  function clampMonth(month: Temporal.PlainYearMonth) {
    const { min, max } = monthLimits.value;
    const last = max?.subtract({ months: duration.value ? 0 : monthCount.value - 1 });
    const first = min && Temporal.PlainYearMonth.compare(month, min) < 0 ? min : month;
    return last && Temporal.PlainYearMonth.compare(first, last) > 0 ? last : first;
  }

  // The rule of `clampMonth` for the first day of a page of weeks or days.
  function clampPageStart(start: Temporal.PlainDate, visible: VisibleDuration) {
    const min =
      props.minDate && alignPageStart(toGridDate(props.minDate), visible, firstDay.value, 'start');
    const max =
      props.maxDate && alignPageStart(toGridDate(props.maxDate), visible, firstDay.value, 'end');
    const first = min && compareDates(start, min) < 0 ? min : start;
    return max && compareDates(first, max) > 0 ? max : first;
  }

  function navigate(step: 1 | -1, event?: Event) {
    const createDetails = () => createChangeEventDetails(REASONS.monthChange, event);
    const visible = duration.value;
    const start = pageStart.value;
    const canContinue = () => (step === 1 ? canNext : canPrevious).value;
    if (visible && start) {
      const next = clampPageStart(
        step === 1 ? start.add(visible) : start.subtract(visible),
        visible,
      );
      return setPageStart(next, createDetails()) && canContinue();
    }
    const target = clampMonth(
      visibleMonth.value.add({ months: step * navigationStep.value.count }),
    );
    return !target.equals(visibleMonth.value) && setMonth(target, createDetails()) && canContinue();
  }

  function showMonth(month: Temporal.PlainYearMonth, pageIndex: number, event?: Event) {
    const target = clampMonth(month.subtract({ months: pageIndex }));
    if (target.equals(visibleMonth.value)) {
      return;
    }
    const details = createChangeEventDetails(REASONS.monthChange, event);
    const visible = duration.value;
    if (visible) {
      // The month of the root stays `target`, so that the select shows the month that the user
      // picked. The limits can move the start of the page to an earlier month.
      const first = target.toPlainDate({ day: 1 });
      setPageStart(
        clampPageStart(alignPageStart(first, visible, firstDay.value, 'start'), visible),
        details,
        target,
      );
      return;
    }
    setMonth(target, details);
  }

  onMounted(() => {
    if (props.autoFocus) {
      focus();
    }
  });

  return {
    locale: formatLocale,
    pages,
    renderedPages,
    isLeaving,
    finishLeaving,
    weekdays,
    weekend,
    multiselectable: selection.multiselectable,
    tabStop,
    rules,
    label,
    navigationDirection,
    navigationStep,
    canPrevious,
    canNext,
    monthLimits,
    navigate,
    showMonth,
    getWeekNumber: (week) => getWeekNumber(week.start, firstDay.value, minimalDays.value),
    toGridDate,
    pressDay,
    onDayFocus,
    onDayKeydown,
    registerDay,
    focus,
  };
}
