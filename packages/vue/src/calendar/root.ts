import {
  computed,
  inject,
  nextTick,
  onMounted,
  shallowRef,
  watch,
  watchEffect,
  type InjectionKey,
  type Ref,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import { formatRangeText, formatText } from '../internals/date-time/calendar/formatText';
import { isTemporalCalendar } from '../internals/date-time/format';
import {
  PickerCalendarOwner,
  usePickerControl,
} from '../internals/date-time/picker/PickerControlContext';
import {
  compareDates,
  isKind,
  isSameDay,
  toPlainDate,
  yearMonthInCalendar,
} from '../internals/date-time/temporal';
import type { DateValue, DayOfWeek } from '../internals/date-time/temporal';
import { useLocale } from '../locale-provider/part';
import { assertModifierNames, canFocus, canSelect, getDayState, getTabStop } from './days';
import type { DayRules } from './days';
import { getFirstDayOfWeek } from './firstDayOfWeek';
import {
  alignPageStart,
  broadcastMonthOf,
  formatPages,
  getBroadcastPage,
  getDurationPage,
  getMonthCells,
  getMonthPage,
  getSpanOfYears,
  getWeekNumber,
  getYearCells,
  ownsDay,
} from './pages';
import { findCellTarget, findDayTarget, getCellMove, getDayMove } from './keys';
import type {
  CalendarBaseProps,
  CalendarCellState,
  CalendarDayState,
  CalendarPage,
  CalendarRootChangeEventDetails,
  CalendarRootChangeEventReason,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
  CalendarState,
  CalendarValue,
  CalendarVisibleDuration,
  CalendarWeek,
} from './types';

type CellUnit = 'month' | 'year';

/** A day button or a cell of a root, while it is mounted. */
export interface CalendarTarget {
  /** The day of a button, or the first day of the month of a cell. */
  readonly date: Temporal.PlainDate;
  readonly element: HTMLElement;
  /** The cells of a row, for a cell. */
  readonly columns?: number;
}

/** What a root gives to its parts. The properties are reactive. */
export interface CalendarForPart {
  readonly state: CalendarState;
  readonly locale: Intl.LocalesArgument;
  readonly view: CalendarRootView;
  /** The root has the views of months and years, and shows them now or can show them. */
  readonly hasViews: boolean;
  /** The value is a year and month, so the grid of months selects. */
  readonly selectsMonths: boolean;
  readonly pages: readonly CalendarPage[];
  readonly navigationDirection: CalendarRootState['navigationDirection'];
  readonly multiselectable: boolean;
  /** The day or the first day of the cell that has the tab stop. */
  readonly tabStop: Temporal.PlainDate | null;
  /** `null` while the root does not know today. */
  readonly today: Temporal.PlainDate | null;
  /** The months of `min` and `max`, in the calendar of the grid. */
  readonly monthLimits: { min?: Temporal.PlainYearMonth; max?: Temporal.PlainYearMonth };
  /** The name of what the grid shows: the pages, a year, or a page of years. */
  readonly label: string;
  readonly monthCells: readonly Temporal.PlainYearMonth[];
  readonly yearCells: readonly Temporal.PlainYearMonth[];
  /** The move of a navigation button. */
  readonly step: { unit: 'month' | 'year' | 'week' | 'day'; count: number };
  dayState(day: Temporal.PlainDate, page: CalendarPage): CalendarDayState;
  /** More attributes for a day button: the pointer listeners and the touch style of a range root. */
  dayButtonProps(day: Temporal.PlainDate): Record<string, unknown> | undefined;
  press(day: Temporal.PlainDate, event: MouseEvent): void;
  canMove(direction: 1 | -1): boolean;
  /** Moves the page one step. Returns `false` at a limit and after a cancel. */
  move(direction: 1 | -1, event: Event): boolean;
  /** Shows `month` in the page at `index`, for a select. */
  showMonth(month: Temporal.PlainYearMonth, index: number, event: Event): void;
  weekNumber(week: CalendarWeek): number;
  cellState(cell: Temporal.PlainYearMonth, unit: CellUnit): CalendarCellState;
  pressCell(cell: Temporal.PlainYearMonth, unit: CellUnit, event: MouseEvent): void;
  toggleView(view: 'month' | 'year', event: MouseEvent): void;
  /** Adds the button of a day or a cell. Returns the function that removes it. */
  addTarget(target: CalendarTarget): () => void;
}

export const calendarKey: InjectionKey<CalendarForPart> = Symbol('calendar');

export function injectCalendar() {
  const calendar = inject(calendarKey, null);
  if (!calendar) {
    throw new Error(
      'Vase UI: A part of Calendar must be inside <Calendar.Root> or <RangeCalendar.Root>. Without a root the part has no days and no selection to show. Put the part inside a root.',
    );
  }
  return calendar;
}

/** The `data-*` attributes of a state. `without` leaves out a state that a selector says. */
export function stateAttributes(
  state: CalendarState,
  without: readonly ('disabled' | 'readonly')[] = [],
): Record<string, string | undefined> {
  const on = (value: boolean) => (value ? '' : undefined);
  return {
    'data-disabled': without.includes('disabled') ? undefined : on(state.disabled),
    'data-readonly': without.includes('readonly') ? undefined : on(state.readonly),
    'data-invalid': on(state.invalid),
    'data-empty': on(state.empty),
  };
}

/** The selection of a root: one value, a list, or a range. The properties are reactive. */
export interface CalendarSelection {
  readonly values: readonly CalendarValue[];
  /** The value that gives the kind, the calendar, the time and the zone of a new value. */
  readonly template: CalendarValue | undefined;
  readonly multiselectable: boolean;
  /** The days of the range of a range root, with its preview. */
  readonly range: { start: Temporal.PlainDate; end: Temporal.PlainDate } | null;
  isSelected(date: Temporal.PlainDate): boolean;
  press(date: Temporal.PlainDate, details: CalendarRootChangeEventDetails): void;
  /** Shift with an arrow key moved the focus from `from` to `date`. */
  extend(
    date: Temporal.PlainDate,
    details: CalendarRootChangeEventDetails,
    from: Temporal.PlainDate,
  ): void;
}

type ViewProps = Pick<
  CalendarRootProps,
  'view' | 'defaultView' | 'visibleYears' | 'disabledMonths' | 'disabledYears'
>;

interface CalendarEmit {
  (
    event: 'monthChange',
    month: Temporal.PlainYearMonth,
    details: CalendarRootChangeEventDetails,
  ): void;
  (event: 'update:month', month: Temporal.PlainYearMonth): void;
  (
    event: 'focusedDateChange',
    date: Temporal.PlainDate,
    details: CalendarRootChangeEventDetails,
  ): void;
  (event: 'update:focusedDate', date: Temporal.PlainDate): void;
  (event: 'viewChange', view: CalendarRootView, details: CalendarRootChangeEventDetails): void;
  (event: 'update:view', view: CalendarRootView): void;
}

/**
 * The state, the pages, the focus and the keys that `Calendar.Root` and `RangeCalendar.Root`
 * share. The root calls it in `setup` and provides `calendar` with `calendarKey`.
 */
export function useCalendar(
  props: CalendarBaseProps & ViewProps,
  options: {
    part: 'Calendar.Root' | 'RangeCalendar.Root';
    emit: (...args: any[]) => void;
    selection: CalendarSelection;
    element: Readonly<Ref<HTMLElement | null>>;
    /** The root has the views of months and years. */
    views: boolean;
    dayButtonProps?: (day: Temporal.PlainDate) => Record<string, unknown> | undefined;
    onTargetRemoved?: (target: CalendarTarget) => void;
  },
) {
  const { part, selection } = options;
  const emit = options.emit as CalendarEmit;
  const create = (reason: CalendarRootChangeEventReason, event: Event) =>
    createChangeEventDetails(reason, event);
  const locale = useLocale(() => props.locale);

  // A server and a browser can give a locale another calendar (test/measurements/calendar.test.ts),
  // so the grid takes no calendar from the locale. The dates of an ISO grid and of a Gregorian grid
  // are the same: the grid and the months that the root emits are ISO.
  const calendar = computed(() => {
    const { template } = selection;
    const own = template && template.calendarId !== 'iso8601' ? template.calendarId : undefined;
    let id = props.calendar ?? own ?? 'gregory';
    // A year and month shows in another calendar only where that calendar has the same months.
    if (isKind(template, 'yearMonth') && !yearMonthInCalendar(template, id))
      id = template.calendarId;
    return id === 'gregory' || !isTemporalCalendar(id) ? 'iso8601' : id;
  });
  const toGridDate = (date: DateValue | Temporal.PlainYearMonth) =>
    toPlainDate(date).withCalendar(calendar.value);

  if (process.env.NODE_ENV !== 'production') {
    watchEffect(() => {
      if (props.broadcastCalendar && calendar.value !== 'iso8601') {
        throw new Error(
          `Vase UI: <${part}> has \`broadcastCalendar\` and shows the calendar \`${calendar.value}\`. ` +
            'The broadcast calendar is made of Gregorian months, so no other calendar can show it. ' +
            'Remove `broadcastCalendar`, or set `calendar="gregory"`.',
        );
      }
      assertModifierNames(part, Object.keys(props.modifiers ?? {}));
    });
  }

  const firstDay = computed<DayOfWeek>(() =>
    props.broadcastCalendar ? 1 : (props.firstDayOfWeek ?? getFirstDayOfWeek(locale.value)),
  );
  const minimalDays = computed(() => props.firstWeekContainsDate ?? (firstDay.value === 1 ? 4 : 1));
  const monthCount = computed(() => Math.max(1, Math.floor(props.numberOfMonths ?? 1)));
  const duration = computed<CalendarVisibleDuration | undefined>(() => {
    const visible = props.visibleDuration;
    if (!visible) return undefined;
    return 'weeks' in visible
      ? { weeks: Math.max(1, Math.floor(visible.weeks)) }
      : { days: Math.max(1, Math.floor(visible.days)) };
  });

  // No render reads the clock, so the server HTML and the hydration agree. The root reads it after
  // the mount, and again at each move of the page by the user.
  const clockDay = shallowRef<Temporal.PlainDate | null>(null);
  function readClock() {
    const template = selection.template;
    const zone = isKind(template, 'zonedDateTime') ? template.timeZoneId : undefined;
    clockDay.value = Temporal.Now.plainDateISO(zone);
  }
  const today = computed(() =>
    props.today === undefined ? clockDay.value : toPlainDate(props.today),
  );

  const isMonthValue = computed(() => options.views && isKind(selection.template, 'yearMonth'));
  const hasViews = computed(() => options.views && !duration.value);
  const viewModel = useModel(() => props.view, props.defaultView);
  const view = computed<CalendarRootView>(() => {
    if (!hasViews.value) return 'day';
    const requested = viewModel.value.value ?? 'day';
    return isMonthValue.value && requested === 'day' ? 'month' : requested;
  });
  const yearCount = computed(() => Math.max(1, Math.floor(props.visibleYears ?? 12)));

  // The day that picks the first page while the root has no month.
  const firstValue = props.focusedDate ?? props.defaultFocusedDate ?? selection.values[0];
  const anchor = computed(() => (firstValue ? toPlainDate(firstValue) : today.value));
  const monthModel = useModel(() => props.month, props.defaultMonth);
  const focusedModel = useModel<Temporal.PlainDate | null>(
    () => props.focusedDate,
    props.defaultFocusedDate ?? null,
  );

  function monthOfDate(date: Temporal.PlainDate) {
    return props.broadcastCalendar ? broadcastMonthOf(date) : date.toPlainYearMonth();
  }
  const monthLimits = computed(() => ({
    ...(props.min && { min: monthOfDate(toGridDate(props.min)) }),
    ...(props.max && { max: monthOfDate(toGridDate(props.max)) }),
  }));

  /** The first month that a page can have, so that the last page holds `max`. `max` wins. */
  function clampMonth(
    month: Temporal.PlainYearMonth,
    pageMonths = duration.value ? 1 : monthCount.value,
  ) {
    const { min, max } = monthLimits.value;
    const last = max?.subtract({ months: pageMonths - 1 });
    const first = min && Temporal.PlainYearMonth.compare(month, min) < 0 ? min : month;
    return last && Temporal.PlainYearMonth.compare(first, last) > 0 ? last : first;
  }

  function clampPageStart(start: Temporal.PlainDate, visible: CalendarVisibleDuration) {
    const min =
      props.min && alignPageStart(toGridDate(props.min), visible, firstDay.value, 'start');
    const max = props.max && alignPageStart(toGridDate(props.max), visible, firstDay.value, 'end');
    const first = min && compareDates(start, min) < 0 ? min : start;
    return max && compareDates(first, max) > 0 ? max : first;
  }

  function clampDate(date: Temporal.PlainDate) {
    const min = props.min && toGridDate(props.min);
    const max = props.max && toGridDate(props.max);
    if (min && compareDates(date, min) < 0) return min;
    return max && compareDates(date, max) > 0 ? max : date;
  }

  // A month of the developer shows as it is. The limits apply to a month that the root picks.
  const visibleMonth = computed(() => {
    const month = monthModel.value.value;
    if (month) return toGridDate(month).toPlainYearMonth();
    const day = anchor.value;
    return day
      ? clampMonth(toGridDate(day).toPlainYearMonth(), view.value === 'day' ? undefined : 1)
      : null;
  });

  // The first day of a page of a duration holds while the root has its month. A move to a page of
  // another month waits in `requestedStart` until the root has that month. The page then changes
  // one time, and a parent that keeps its `month` keeps the page.
  interface DurationStart {
    day: Temporal.PlainDate;
    month: Temporal.PlainYearMonth;
  }
  const durationStart = shallowRef<DurationStart | null>(null);
  const requestedStart = shallowRef<DurationStart | null>(null);
  function isOfVisibleMonth(start: DurationStart | null): start is DurationStart {
    const month = visibleMonth.value;
    return !!start && !!month && toGridDate(start.month).toPlainYearMonth().equals(month);
  }
  const pageStart = computed(() => {
    const visible = duration.value;
    const month = visibleMonth.value;
    if (!visible || !month) return null;
    const start = [requestedStart.value, durationStart.value].find(isOfVisibleMonth);
    if (start) return toGridDate(start.day);
    const given = !!monthModel.value.value;
    const day = given ? month.toPlainDate({ day: 1 }) : anchor.value && toGridDate(anchor.value);
    if (!day) return null;
    const first = alignPageStart(day, visible, firstDay.value, 'start');
    return given ? first : clampPageStart(first, visible);
  });

  const pages = computed<CalendarPage[]>(() => {
    const month = visibleMonth.value;
    if (!month) return [];
    const visible = duration.value;
    if (visible) return pageStart.value ? [getDurationPage(pageStart.value, visible, month)] : [];
    return Array.from({ length: monthCount.value }, (_, index) => {
      const pageMonth = month.add({ months: index });
      return props.broadcastCalendar
        ? getBroadcastPage(pageMonth, !!props.fixedWeeks)
        : getMonthPage(pageMonth, firstDay.value, !!props.fixedWeeks);
    });
  });

  const navigationDirection = shallowRef<CalendarRootState['navigationDirection']>('none');
  // The watcher runs before the render, so the new month renders with its direction.
  watch(
    () => [pages.value[0]?.first.toString(), calendar.value, firstDay.value] as const,
    ([next, nextCalendar, nextDay], [previous, previousCalendar, previousDay]) => {
      if (!next || !previous || nextCalendar !== previousCalendar || nextDay !== previousDay)
        return;
      const order = compareDates(Temporal.PlainDate.from(next), Temporal.PlainDate.from(previous));
      if (order !== 0) navigationDirection.value = order < 0 ? 'previous' : 'next';
    },
  );

  const rules = computed<DayRules>(() => ({
    today: today.value,
    disabled: !!props.disabled,
    min: props.min,
    max: props.max,
    disabledDates: props.disabledDates,
    unavailableDates: props.unavailableDates,
    hiddenDates: props.hiddenDates,
    modifiers: props.modifiers,
    showOutsideDays: props.showOutsideDays ?? !!props.broadcastCalendar,
    pages: pages.value,
    isSelected: (date) => selection.isSelected(date),
    range: selection.range,
  }));
  // A day with no page is not outside a month, so a key can go to a day of another month.
  const stateOf = (date: Temporal.PlainDate) => getDayState(date, null, rules.value);

  const dayTabStop = computed(() =>
    getTabStop(
      pages.value.flatMap((page) =>
        page.weeks.flatMap((week) =>
          week.days.filter((day) => canFocus(getDayState(day, page, rules.value))),
        ),
      ),
      focusedModel.value.value,
      (date) => selection.isSelected(date),
      today.value,
    ),
  );

  // The grid of months shows the months of one year, and the grid of years a page of years. A cell
  // is a month, or the first month of a year. The root finds a cell by the first day of its month.
  const monthCells = computed(() => (visibleMonth.value ? getMonthCells(visibleMonth.value) : []));
  const yearCells = computed(() =>
    visibleMonth.value ? getYearCells(visibleMonth.value, yearCount.value) : [],
  );
  const selectedMonths = computed(() =>
    selection.values.map((value) => toGridDate(value).toPlainYearMonth()),
  );
  const todayMonth = computed(() => today.value && toGridDate(today.value).toPlainYearMonth());

  function isCellDisabled(cell: Temporal.PlainYearMonth, unit: CellUnit) {
    const { min, max } = monthLimits.value;
    if (props.disabled) return true;
    if (unit === 'year') {
      return (
        (!!min && cell.year < min.year) ||
        (!!max && cell.year > max.year) ||
        props.disabledYears?.(cell) === true
      );
    }
    return (
      (!!min && Temporal.PlainYearMonth.compare(cell, min) < 0) ||
      (!!max && Temporal.PlainYearMonth.compare(cell, max) > 0) ||
      props.disabledMonths?.(cell) === true
    );
  }

  function cellState(cell: Temporal.PlainYearMonth, unit: CellUnit): CalendarCellState {
    const same = (month: Temporal.PlainYearMonth) =>
      unit === 'year' ? month.year === cell.year : month.equals(cell);
    return {
      selected: selectedMonths.value.some(same),
      disabled: isCellDisabled(cell, unit),
      current: !!todayMonth.value && same(todayMonth.value),
    };
  }

  const cellUnit = (): CellUnit => (view.value === 'year' ? 'year' : 'month');
  const cellDate = (cell: Temporal.PlainYearMonth) => cell.toPlainDate({ day: 1 });
  const cellOf = (date: Temporal.PlainDate) => {
    const month = date.toPlainYearMonth();
    return view.value === 'year' ? month.with({ month: 1 }) : month;
  };

  const cellTabStop = computed(() => {
    const unit = cellUnit();
    const focused = focusedModel.value.value;
    return getTabStop(
      (unit === 'year' ? yearCells.value : monthCells.value)
        .filter((cell) => !cellState(cell, unit).disabled)
        .map(cellDate),
      focused && cellDate(cellOf(toGridDate(focused))),
      (day) => cellState(cellOf(day), unit).selected,
      today.value && cellDate(cellOf(toGridDate(today.value))),
    );
  });
  const tabStop = computed(() => (view.value === 'day' ? dayTabStop.value : cellTabStop.value));

  const label = computed(() => {
    const month = visibleMonth.value;
    if (!month) return '';
    if (view.value === 'month') return formatText(month, { year: 'numeric' }, locale.value);
    const first = yearCells.value[0];
    const last = yearCells.value.at(-1);
    if (view.value === 'year' && first && last) {
      return formatRangeText(first, last, { year: 'numeric' }, locale.value);
    }
    return formatPages(pages.value, locale.value);
  });

  /**
   * A move of the user gives `monthChange`, then `update:month`. A move with no user event, such
   * as for a write of the parent, gives `update:month` only.
   */
  function setMonth(
    month: Temporal.PlainYearMonth,
    details: CalendarRootChangeEventDetails | null,
  ) {
    if (details) {
      emit('monthChange', month, details);
      if (details.isCanceled) return false;
      if (props.today === undefined) readClock();
    }
    monthModel.setOwn(month);
    emit('update:month', month);
    return true;
  }

  function setPageStart(
    day: Temporal.PlainDate,
    details: CalendarRootChangeEventDetails | null,
    month = day.toPlainYearMonth(),
  ) {
    const start = { day, month };
    if (isOfVisibleMonth(start)) {
      // The page moves in its month, so `setMonth` does not read the clock.
      if (details && props.today === undefined) readClock();
      durationStart.value = start;
      requestedStart.value = null;
      return true;
    }
    if (isOfVisibleMonth(requestedStart.value)) durationStart.value = requestedStart.value;
    requestedStart.value = start;
    if (!setMonth(month, details)) {
      requestedStart.value = null;
      return false;
    }
    return true;
  }

  function setFocusedDate(
    date: Temporal.PlainDate,
    details: CalendarRootChangeEventDetails | null,
  ) {
    if (details) {
      emit('focusedDateChange', date, details);
      if (details.isCanceled) return false;
    }
    focusedModel.setOwn(date);
    emit('update:focusedDate', date);
    return true;
  }

  function setView(next: CalendarRootView, details: CalendarRootChangeEventDetails) {
    if (!hasViews.value || next === view.value) return false;
    emit('viewChange', next, details);
    if (details.isCanceled) return false;
    viewModel.setOwn(next);
    emit('update:view', next);
    return true;
  }

  // Shows the page that holds `date`. A date after the page starts the new page, and a date before
  // it ends the new page, so the page moves the way that the date does.
  function showDate(
    date: Temporal.PlainDate,
    createDetails: () => CalendarRootChangeEventDetails | null,
  ) {
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
    const isBefore = !!first && compareDates(date, first.first) < 0;
    return setMonth(
      clampMonth(isBefore ? month.subtract({ months: monthCount.value - 1 }) : month),
      createDetails(),
    );
  }

  function isShown(date: Temporal.PlainDate) {
    return pages.value.some(
      (page) =>
        compareDates(date, page.start) >= 0 &&
        compareDates(date, page.end) <= 0 &&
        !getDayState(date, page, rules.value).hidden,
    );
  }

  const isOwned = (date: Temporal.PlainDate) => pages.value.some((page) => ownsDay(page, date));

  const targets: CalendarTarget[] = [];
  // The day that takes the focus when its button mounts.
  let waitingFocus: Temporal.PlainDate | null = null;
  const elementOf = (date: Temporal.PlainDate) =>
    targets.find((target) => isSameDay(target.date, date) && target.element.isConnected)?.element;
  const targetOf = (element: EventTarget | null) =>
    targets.find((target) => target.element === element);

  // The button of a day that the page shows now mounts in the next flush.
  function focusDay(date: Temporal.PlainDate) {
    waitingFocus = null;
    void nextTick(() => {
      const element = elementOf(date);
      if (element) element.focus();
      else waitingFocus = date;
    });
  }

  const onPickerSelect = usePickerControl(PickerCalendarOwner, () =>
    tabStop.value ? elementOf(tabStop.value) : null,
  );

  function moveFocus(
    date: Temporal.PlainDate,
    createDetails: () => CalendarRootChangeEventDetails | null,
  ) {
    if (!isShown(date) && !showDate(date, createDetails)) return false;
    if (!setFocusedDate(date, createDetails())) return false;
    focusDay(date);
    return true;
  }

  function isOnCellPage(cell: Temporal.PlainYearMonth) {
    return view.value === 'year'
      ? yearCells.value.some((year) => year.year === cell.year)
      : cell.year === visibleMonth.value?.year;
  }

  // The day that the focus takes in a cell: the day of the focused day in that month, or the
  // focused day in that year. A month with fewer days gives its last day.
  function dateOfCell(cell: Temporal.PlainYearMonth) {
    const base = toGridDate(
      focusedModel.value.value ?? selection.values[0] ?? today.value ?? cellDate(cell),
    );
    return view.value === 'year'
      ? base.add({ years: cell.year - base.year })
      : cell.toPlainDate({ day: Math.min(base.day, cell.daysInMonth) });
  }

  function moveCellFocus(
    cell: Temporal.PlainYearMonth,
    createDetails: () => CalendarRootChangeEventDetails | null,
    date = dateOfCell(cell),
  ) {
    const target = clampDate(date);
    if (
      !isOnCellPage(cell) &&
      !setMonth(clampMonth(target.toPlainYearMonth(), 1), createDetails())
    ) {
      return false;
    }
    if (!setFocusedDate(target, createDetails())) return false;
    focusDay(cellDate(cell));
    return true;
  }

  // The parent writes `focusedDate`: the page shows that day, with `update:month` only. A text
  // compares the days, because a parent can give a new object for the same day at each render.
  watch(
    () => props.focusedDate?.toString(),
    () => {
      if (!props.focusedDate) return;
      const date = clampDate(toGridDate(props.focusedDate));
      if (view.value !== 'day') {
        if (!isOnCellPage(cellOf(date))) setMonth(clampMonth(date.toPlainYearMonth(), 1), null);
      } else if (!isShown(date) && !isOwned(date)) {
        showDate(date, () => null);
      }
    },
  );

  watch(view, (next) => {
    navigationDirection.value = 'none';
    // A grid of months or of years can show the month of `max`. The pages of days keep to the limits.
    const month = visibleMonth.value;
    if (next === 'day' && month && !clampMonth(month).equals(month))
      setMonth(clampMonth(month), null);
  });

  // The tab stop moves for a cause that is not a focus event, such as a write of the parent, a new
  // view, new rules or a new page. While a day or a cell has the focus, the tab stop takes it after
  // the flush. The root never takes the focus from an element outside the grids.
  watch(
    () => `${view.value} ${tabStop.value?.toString()}`,
    () => {
      const doc = options.element.value?.ownerDocument;
      if (!doc || !targetOf(doc.activeElement)) return;
      void nextTick(() => {
        const active = doc.activeElement;
        const stop = tabStop.value;
        if (stop && (active === null || active === doc.body || targetOf(active))) focusDay(stop);
      });
    },
  );

  function press(date: Temporal.PlainDate, event: MouseEvent) {
    const state = stateOf(date);
    if (!props.readonly && canSelect(state)) {
      const details = create('day-press', event);
      selection.press(date, details);
      if (!details.isCanceled) onPickerSelect?.(event);
    }
    // A day that no page owns shows as an outside day. A press on it shows its page.
    if (canFocus(state) && !isOwned(date)) {
      showDate(date, () => create('day-press', event));
      focusDay(date);
    }
  }

  function onDayKeydown(date: Temporal.PlainDate, event: KeyboardEvent, rtl: boolean) {
    const action = getDayMove(event.key, event.shiftKey, {
      rtl,
      canExtend: selection.multiselectable,
    });
    if (!action) return;
    event.preventDefault();
    const target = findDayTarget(date, action.move, {
      firstDay: firstDay.value,
      canFocus: (day) => canFocus(stateOf(day)),
      min: props.min && toGridDate(props.min),
      max: props.max && toGridDate(props.max),
    });
    if (!target || !moveFocus(target, () => create('keyboard', event))) return;
    if (action.extend && !props.readonly && canSelect(stateOf(target))) {
      selection.extend(target, create('keyboard', event), date);
    }
  }

  function onCellKeydown(
    cell: Temporal.PlainYearMonth,
    columns: number,
    event: KeyboardEvent,
    rtl: boolean,
  ) {
    if (event.shiftKey) return;
    const move = getCellMove(event.key, { rtl, columns });
    if (!move) return;
    event.preventDefault();
    const unit = cellUnit();
    const target = findCellTarget(cell, move, {
      unit,
      columns,
      visibleYears: yearCount.value,
      canFocus: (candidate) => !cellState(candidate, unit).disabled,
      min: monthLimits.value.min,
      max: monthLimits.value.max,
    });
    if (target) moveCellFocus(target, () => create('keyboard', event));
  }

  function onFocusin(event: FocusEvent) {
    waitingFocus = null;
    const target = targetOf(event.target);
    if (!target) return;
    const focused = focusedModel.value.value;
    if (view.value === 'day') {
      if (!focused || !isSameDay(focused, target.date)) {
        setFocusedDate(target.date, create('none', event));
      }
      return;
    }
    const cell = cellOf(target.date);
    const same = (other: Temporal.PlainYearMonth) =>
      view.value === 'year' ? other.year === cell.year : other.equals(cell);
    if (!focused || !same(cellOf(toGridDate(focused)))) {
      setFocusedDate(clampDate(dateOfCell(cell)), create('none', event));
    }
  }

  function onKeydown(event: KeyboardEvent) {
    waitingFocus = null;
    const target = targetOf(event.target);
    if (!target || event.ctrlKey || event.altKey || event.metaKey) return;
    const rtl = getComputedStyle(target.element).direction === 'rtl';
    if (view.value === 'day') onDayKeydown(target.date, event, rtl);
    else onCellKeydown(cellOf(target.date), target.columns ?? 1, event, rtl);
  }

  const step = computed<CalendarForPart['step']>(() => {
    if (view.value !== 'day') {
      return { unit: 'year', count: view.value === 'year' ? yearCount.value : 1 };
    }
    const visible = duration.value;
    if (visible) {
      return 'weeks' in visible
        ? { unit: 'week', count: visible.weeks }
        : { unit: 'day', count: visible.days };
    }
    return { unit: 'month', count: props.pagedNavigation ? monthCount.value : 1 };
  });

  // The days that the grid of months or of years covers: the years of its page.
  const yearSpan = computed(() => {
    const years = view.value === 'year' ? yearCells.value : monthCells.value;
    const first = years[0];
    const last = years.at(-1);
    return first && last ? getSpanOfYears(first, last) : null;
  });
  const canPrevious = computed(() => {
    const first = view.value === 'day' ? pages.value[0]?.first : yearSpan.value?.first;
    return !!first && (props.min === undefined || compareDates(first, props.min) > 0);
  });
  const canNext = computed(() => {
    const last = view.value === 'day' ? pages.value.at(-1)?.last : yearSpan.value?.last;
    return !!last && (props.max === undefined || compareDates(last, props.max) < 0);
  });

  function move(direction: 1 | -1, event: Event) {
    const month = visibleMonth.value;
    if (!month || !(direction === 1 ? canNext : canPrevious).value) return false;
    const details = () => create('month-change', event);
    const canGoOn = () => (direction === 1 ? canNext : canPrevious).value;
    if (view.value !== 'day') {
      const target = clampMonth(month.add({ years: direction * step.value.count }), 1);
      return !target.equals(month) && setMonth(target, details()) && canGoOn();
    }
    const visible = duration.value;
    const start = pageStart.value;
    if (visible && start) {
      const next = clampPageStart(
        direction === 1 ? start.add(visible) : start.subtract(visible),
        visible,
      );
      return setPageStart(next, details()) && canGoOn();
    }
    const target = clampMonth(month.add({ months: direction * step.value.count }));
    return !target.equals(month) && setMonth(target, details()) && canGoOn();
  }

  function showMonth(month: Temporal.PlainYearMonth, index: number, event: Event) {
    const target = clampMonth(month.subtract({ months: index }));
    if (target.equals(visibleMonth.value ?? target)) return;
    const details = create('month-change', event);
    const visible = duration.value;
    if (visible) {
      // The month of the root stays `target`, so that the select shows the month that the user
      // picked. The limits can move the start of the page to an earlier month.
      const first = alignPageStart(
        target.toPlainDate({ day: 1 }),
        visible,
        firstDay.value,
        'start',
      );
      setPageStart(clampPageStart(first, visible), details, target);
      return;
    }
    setMonth(target, details);
  }

  function pressCell(cell: Temporal.PlainYearMonth, unit: CellUnit, event: MouseEvent) {
    const month = visibleMonth.value;
    if (!month || isCellDisabled(cell, unit)) return;
    if (unit === 'month' && isMonthValue.value) {
      // A month of a value that is a year and month is a value.
      if (!props.readonly) {
        const details = create('month-press', event);
        selection.press(cellDate(cell), details);
        if (!details.isCanceled) onPickerSelect?.(event);
      }
      return;
    }
    const reason = unit === 'month' ? 'month-press' : 'year-press';
    const target =
      unit === 'month'
        ? clampMonth(cell)
        : clampMonth(month.add({ years: cell.year - month.year }), 1);
    // A cancel of the month keeps the view.
    if (target.equals(month) || setMonth(target, create(reason, event))) {
      setView(unit === 'month' ? 'day' : 'month', create(reason, event));
    }
  }

  function toggleView(target: 'month' | 'year', event: MouseEvent) {
    const month = visibleMonth.value;
    if (!month) return;
    const next = view.value === target ? (isMonthValue.value ? 'month' : 'day') : target;
    // A grid of months or of years can show the month of `max`. The pages of days keep to the limits.
    const clamped = clampMonth(month);
    if (
      next === 'day' &&
      !clamped.equals(month) &&
      !setMonth(clamped, create('trigger-press', event))
    ) {
      return;
    }
    setView(next, create('trigger-press', event));
  }

  /** With a day, the page shows that day first. With none, the tab stop takes the focus. */
  function focus(date?: DateValue) {
    if (date === undefined) {
      if (tabStop.value) focusDay(tabStop.value);
      return;
    }
    const target = toGridDate(date);
    if (view.value !== 'day') {
      const cell = cellOf(target);
      if (!cellState(cell, cellUnit()).disabled) moveCellFocus(cell, () => null, target);
      return;
    }
    if (canFocus(stateOf(target))) moveFocus(target, () => null);
  }

  onMounted(() => {
    if (props.today === undefined) readClock();
    if (props.autofocus) focus();
  });

  const state = computed<CalendarState>(() => ({
    disabled: !!props.disabled,
    readonly: !!props.readonly,
    invalid: !!props.invalid,
    empty: selection.values.length === 0,
  }));
  const rootState = computed<CalendarRootState>(() => ({
    ...state.value,
    view: view.value,
    multipleMonths: pages.value.length > 1,
    navigationDirection: navigationDirection.value,
    broadcastCalendar: !!props.broadcastCalendar,
  }));

  const forParts: CalendarForPart = {
    get state() {
      return state.value;
    },
    get locale() {
      return locale.value;
    },
    get view() {
      return view.value;
    },
    get hasViews() {
      return hasViews.value;
    },
    get selectsMonths() {
      return isMonthValue.value;
    },
    get pages() {
      return pages.value;
    },
    get navigationDirection() {
      return navigationDirection.value;
    },
    get multiselectable() {
      return selection.multiselectable;
    },
    get tabStop() {
      return tabStop.value;
    },
    get today() {
      return today.value;
    },
    get monthLimits() {
      return monthLimits.value;
    },
    get label() {
      return label.value;
    },
    get monthCells() {
      return monthCells.value;
    },
    get yearCells() {
      return yearCells.value;
    },
    get step() {
      return step.value;
    },
    dayState: (day, page) => getDayState(day, page, rules.value),
    dayButtonProps: (day) => options.dayButtonProps?.(day),
    press,
    canMove: (direction) => (direction === 1 ? canNext : canPrevious).value,
    move,
    showMonth,
    weekNumber: (week) => getWeekNumber(week.start, firstDay.value, minimalDays.value),
    cellState,
    pressCell,
    toggleView,
    addTarget(target) {
      targets.push(target);
      if (waitingFocus && isSameDay(waitingFocus, target.date)) {
        waitingFocus = null;
        target.element.focus();
      }
      return () => {
        targets.splice(targets.indexOf(target), 1);
        options.onTargetRemoved?.(target);
      };
    },
  };

  return {
    calendar: forParts,
    rootState,
    focus,
    /** The day of a button of the root that holds `element`, or `null`. */
    dayAt(element: Element | null) {
      for (let node = element; node; node = node.parentElement) {
        const target = targetOf(node);
        if (target) return target.date;
      }
      return null;
    },
    rootProps: () => ({
      role: 'group',
      'aria-label': label.value || undefined,
      ...stateAttributes(state.value),
      'data-view': view.value,
      'data-navigation-direction': navigationDirection.value,
      onFocusin,
      onKeydown,
    }),
  };
}
