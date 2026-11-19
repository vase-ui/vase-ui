import {
  computed,
  nextTick,
  onMounted,
  readonly,
  shallowRef,
  toValue,
  watch,
  watchEffect,
  watchPostEffect,
} from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { useServerValue } from '../../../common/hydration';
import { ownerDocument } from '../../../common/owner';
import { activeElement } from '../../../common/shadowDom';
import { useControlled } from '../../../common/useControlled';
import { useFormatLocale } from '../../../utils/useFormatLocale';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../createVaseUIEventDetails';
import { useDirection } from '../../direction-context/DirectionContext';
import { REASONS } from '../../reasons';
import { useKeepAliveState } from '../../useKeepAliveState';
import { displayCalendar } from '../displayCalendar';
import { isTemporalCalendar, parseDaysOfWeek, weekInfo } from '../format';
import type { DateMatcher } from '../matchers';
import { PickerCalendarOwner, usePickerControl } from '../picker/PickerControlContext';
import {
  compareDates,
  isKind,
  isSameDay,
  parseInputText,
  today,
  toInputText,
  toPlainDate,
} from '../temporal';
import type { DateValue, DayOfWeek } from '../temporal';
import { assertModifierNames, canFocus, canSelect, getDayState, ownsDay } from './dayState';
import type { DayRules } from './dayState';
import { formatPages, formatRangeText, formatText } from './formatText';
import {
  createWeek,
  dayOfWeekOf,
  getMonthPage,
  getPageKey,
  startOfWeek,
  weekdaysFrom,
} from './monthGrid';
import type { CalendarPage, CalendarPageWeek } from './monthGrid';
import { getMonthCells, getSpanOfYears, getYearCells, getYearPageStart } from './viewPages';
import type { CalendarCellState } from './viewPages';

/** The reasons that each calendar root has, whatever its selection and its views. */
export type CalendarBaseChangeEventReason =
  | typeof REASONS.dayPress
  | typeof REASONS.keyboard
  | typeof REASONS.monthChange
  | typeof REASONS.none;

/** The reasons that only a calendar with the views of months and years has. */
export type CalendarViewChangeEventReason =
  typeof REASONS.monthPress | typeof REASONS.yearPress | typeof REASONS.triggerPress;

export type CalendarChangeEventReason =
  CalendarBaseChangeEventReason | CalendarViewChangeEventReason;

export type CalendarBaseChangeEventDetails =
  VaseUIChangeEventDetails<CalendarBaseChangeEventReason>;
export type CalendarChangeEventDetails = VaseUIChangeEventDetails<CalendarChangeEventReason>;

/** What a calendar can select: a day, or a year and month. */
export type CalendarValue = DateValue | Temporal.PlainYearMonth;

/** What the grid shows: the days of a month, the months of a year, or a page of years. */
export type CalendarView = 'day' | 'month' | 'year';

/** The props of a calendar that has the views of months and years. */
export interface CalendarViewProps {
  /**
   * What the grid shows: `day` the days of the months, `month` the months of a year, and `year` a
   * page of years. A value that is a year and month has no days, so its first view is `month`.
   * A calendar with `visibleDuration` shows days only. Use it when controlled.
   */
  view?: CalendarView | undefined;
  /**
   * What the grid shows when it first renders. The default is `day`, and `month` for a value that is
   * a year and month.
   */
  defaultView?: CalendarView | undefined;
  /**
   * The number of years on a page of years. A page starts with a year that is a multiple of this
   * number, so the page that holds 2026 starts with 2016 when the number is 12.
   * @default 12
   */
  visibleYears?: number | undefined;
  /**
   * Whether a month cannot take focus and cannot be selected. The function gets each month of the
   * grid, in the calendar of the grid. A month before `minDate` or after `maxDate` is disabled too.
   */
  disabledMonths?: ((month: Temporal.PlainYearMonth) => boolean) | undefined;
  /**
   * Whether a year cannot take focus and cannot be selected. The function gets the first month of
   * each year of the grid, in the calendar of the grid. A year before `minDate` or after `maxDate`
   * is disabled too.
   */
  disabledYears?: ((year: Temporal.PlainYearMonth) => boolean) | undefined;
}

/** The props that each calendar root has, whatever its selection. */
export interface CalendarBaseProps {
  /**
   * The month that the grid shows. With `numberOfMonths`, it is the first month. With
   * `visibleDuration`, the page starts on a day of this month, or with the week that holds its
   * first day, and a move of the page gives the month of its first day. A month or year select can
   * start the page earlier, so that the page ends with the week or the day of `maxDate`. When the
   * grid has another calendar than this month, the grid shows the month that holds the first day of
   * this month. The grid of months shows the year of this month, and the grid of years shows the
   * page of years that holds that year. Use it when controlled.
   */
  month?: Temporal.PlainYearMonth | undefined;
  /**
   * The month that the grid shows when it first renders, as `month` describes it. With no value, the
   * month of the focused day, else of the selected day, else of today. The root applies `minDate`
   * and `maxDate` to that month, as it does for a move of the page. It shows a value of this prop
   * as it is.
   */
  defaultMonth?: Temporal.PlainYearMonth | undefined;
  /**
   * The day that the user focused last, and that has the tab stop. `null` means no such day. When
   * it changes to a day that no page of the grid shows or holds, the grid shows the page of that
   * day. For a day outside `minDate` and `maxDate`, it shows the page of the limit. When that page
   * is in another month, the root emits `monthChange`. With a controlled `month`, the page moves
   * when the consumer gives that month. Use it when controlled.
   */
  focusedDate?: Temporal.PlainDate | null | undefined;
  /**
   * The day that has the tab stop when the calendar first renders.
   */
  defaultFocusedDate?: Temporal.PlainDate | null | undefined;
  /**
   * The number of months that the grid shows at one time, one after the other.
   * @default 1
   */
  numberOfMonths?: number | undefined;
  /**
   * Whether the two navigation buttons move by `numberOfMonths` months. Without it, they move by
   * one month.
   * @default false
   */
  pagedNavigation?: boolean | undefined;
  /**
   * Whether each month has the same number of weeks, so that the grid has the same height in each
   * month: six weeks, and five weeks with `broadcastCalendar`.
   * @default false
   */
  fixedWeeks?: boolean | undefined;
  /**
   * Whether the days of the months around a month have a button. The default is `false`, and `true`
   * with `broadcastCalendar`. Two months of the grid that share a day show it one time, in the
   * month that owns it. A press on a day that no month of the grid owns shows its month.
   */
  showOutsideDays?: boolean | undefined;
  /**
   * The first day of the week, from `1` for Monday to `7` for Sunday.
   * The default is the first day of the week of the locale.
   */
  firstDayOfWeek?: DayOfWeek | undefined;
  /**
   * Whether the weeks follow ISO 8601: they start on Monday and have their ISO number.
   * `firstDayOfWeek` and `firstWeekContainsDate` do not apply.
   * @default false
   */
  isoWeek?: boolean | undefined;
  /**
   * The day of January that is always in the first week of the year, from `1` to `7`. The default
   * is `4` for weeks that start on Monday, which gives the ISO 8601 number of the week, and `1` for
   * the other weeks.
   */
  firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
  /**
   * Whether the grid shows the broadcast calendar. Its weeks start on Monday, and a month has the
   * 4 or 5 weeks from the Monday of the week that holds its first day. It needs the Gregorian
   * calendar.
   * @default false
   */
  broadcastCalendar?: boolean | undefined;
  /**
   * Shows one page of whole weeks, `{ weeks: 2 }`, or one row of days, `{ days: 5 }`, in place of
   * a month. The navigation buttons move by the duration. A key that moves the focus out of the page
   * shows the page that holds the day. `numberOfMonths` and `fixedWeeks` do not apply.
   */
  visibleDuration?: VisibleDuration | undefined;
  /**
   * The first day that the user can select. An earlier day is disabled. A page that the root picks
   * or moves to does not start before the page of this day, unless `maxDate` does not allow it.
   */
  minDate?: DateValue | undefined;
  /**
   * The last day that the user can select. A later day is disabled. A page that the root picks or
   * moves to does not end after the page of this day. This rule wins over `minDate`.
   */
  maxDate?: DateValue | undefined;
  /**
   * The days that can neither take focus nor be selected. The value is a date, a range
   * `{ start, end }`, `{ before }`, `{ after }`, `{ dayOfWeek }`, a function that gets a
   * `Temporal.PlainDate`, or a list of these.
   */
  disabledDates?: DateMatcher | undefined;
  /**
   * The days that can take focus and cannot be selected. It has the same forms as `disabledDates`.
   */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The days that have no button. It has the same forms as `disabledDates`.
   */
  hiddenDates?: DateMatcher | undefined;
  /**
   * A matching day has a kebab-case `data-*` attribute for each modifier. Its
   * `state.modifiers[name]` gives the match. Names of built-in day attributes are reserved.
   */
  modifiers?: Record<string, DateMatcher> | undefined;
  /**
   * The day that is today. The default is the day of the clock in `timeZone`.
   * A server render and the hydration show the day of the clock of the server. After the mount, the
   * calendar shows the day of the clock of the browser. Give `today` when the server knows the day
   * of the visitor.
   */
  today?: DateValue | undefined;
  /**
   * The time zone in which the clock gives today. The default is the zone of the value, and then
   * the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * The locale of the names and the numbers, and of the first day of the week and the weekend.
   * The default is the runtime locale. When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar of the grid, such as `gregory` or `persian`. The default is the calendar of the
   * value when it is not ISO, and then the calendar of the locale. `gregory` turns the calendar of
   * the locale off. The value keeps its own calendar.
   */
  calendar?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a day. The days still take focus.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the value of the calendar is not valid.
   * @default false
   */
  invalid?: boolean | undefined;
  /**
   * Whether the day that has the tab stop gets focus when the calendar mounts.
   * @default false
   */
  autoFocus?: boolean | undefined;
}

interface CalendarSelection<Details = CalendarBaseChangeEventDetails> {
  /** The values of the selection: none, one, or each value of a list. */
  values: ComputedRef<readonly CalendarValue[]>;
  /**
   * The value that gives the kind, the calendar, the time and the zone of a new value: the first
   * value, else the first value of `defaultValue`, else the last value that the selection had. A
   * value that becomes empty thus keeps its kind, as the type of its model does.
   */
  template: ComputedRef<CalendarValue | undefined>;
  /**
   * Whether the grid selects more than one day. The grid then has `aria-multiselectable`, and
   * Shift with an arrow key calls `extend` and does not move a month or a year.
   */
  multiselectable: ComputedRef<boolean>;
  /** Whether `date` is in the selection. It reads the selection, so a `computed` follows it. */
  isSelected: (date: Temporal.PlainDate) => boolean;
  /** A press on a day that the user can select. */
  press: (date: Temporal.PlainDate, details: Details) => void;
  /**
   * The move of the focus by Shift with an arrow key to a day that the user can select. `from` is
   * the day that had the focus before the key.
   */
  extend: (date: Temporal.PlainDate, details: Details, from: Temporal.PlainDate) => void;
}

interface CalendarRootEmit<Details> {
  (event: 'monthChange', month: Temporal.PlainYearMonth, details: Details): void;
  (event: 'update:month', month: Temporal.PlainYearMonth): void;
  (event: 'focusedDateChange', date: Temporal.PlainDate, details: Details): void;
  (event: 'update:focusedDate', date: Temporal.PlainDate): void;
}

interface CalendarViewEmit {
  (event: 'viewChange', view: CalendarView, details: CalendarChangeEventDetails): void;
  (event: 'update:view', view: CalendarView): void;
}

/** The first day of the page of a duration, and the month of the root for that page. */
interface DurationStart {
  day: Temporal.PlainDate;
  month: Temporal.PlainYearMonth;
}

interface CalendarRootOptions<Details> {
  /** The name of the root part in the messages. */
  part: string;
  props: CalendarBaseProps;
  emit: CalendarRootEmit<Details>;
  selection: CalendarSelection<Details>;
}

/** A root with no views shows days only, so no event of the root has a reason of the views. */
interface UseCalendarRootOptionsWithoutViews extends CalendarRootOptions<CalendarBaseChangeEventDetails> {
  views?: undefined;
}

/** A root with the views of months and years. Its events also have the reasons of the views. */
interface UseCalendarRootOptionsWithViews extends CalendarRootOptions<CalendarChangeEventDetails> {
  views: true;
  props: CalendarBaseProps & CalendarViewProps;
  emit: CalendarRootEmit<CalendarChangeEventDetails> & CalendarViewEmit;
}

type UseCalendarRootOptions = UseCalendarRootOptionsWithoutViews | UseCalendarRootOptionsWithViews;

export type CalendarRootController = ReturnType<typeof useCalendarRoot>;

/**
 * The state and the keys of a calendar root. A root calls it in `setup` after `assertTemporal`.
 * The root owns the focused day and the month of the page. The pages, the tab stop and the keys
 * derive from them and from the selection.
 */
export function useCalendarRoot(options: UseCalendarRootOptions) {
  const { part, props } = options;
  const emit: CalendarRootEmit<CalendarBaseChangeEventDetails> = options.emit;
  const selection: CalendarSelection = options.selection;
  // Only a root with views has listeners and a selection that take the reasons of the views.
  // A root with no views gets no press on its view trigger, a month or a year. Its trigger is
  // disabled, and its grids of months and of years do not render.
  const views = options.views ? options : undefined;
  const formatLocale = useFormatLocale(() => props.locale);
  const direction = useDirection();
  const name = part.replace(/\.Root$/, '');

  // A server and a browser can have other `Intl` data for one locale: another calendar, first day
  // of the week or weekend. While the root hydrates, these values thus come from the server HTML.
  //
  // The dates of an ISO grid and of a Gregorian grid are the same, so the dates of the grid and
  // the months that the root emits are ISO and not Gregorian. The text still follows the locale.
  const { value: calendar, attributes: calendarAttributes } = useServerValue(
    'data-vase-ui-calendar',
    () => {
      const id = displayCalendar(props.calendar, selection.template.value, formatLocale.value);
      return id === 'gregory' ? 'iso8601' : id;
    },
    (text) => (isTemporalCalendar(text) ? text : undefined),
  );

  if (process.env.NODE_ENV !== 'production') {
    watchEffect(() => {
      const id = calendar.value;
      if (props.broadcastCalendar === true && id !== 'iso8601') {
        throw new Error(
          `Vase UI: <${part}> has \`broadcastCalendar\` and shows the calendar \`${id}\`. ` +
            'The broadcast calendar is made of Gregorian months, so no other calendar can show it. ' +
            'Remove `broadcastCalendar`, or set `calendar="gregory"`.',
        );
      }
    });
  }

  const weekData = computed(() => weekInfo(formatLocale.value));
  const { value: firstDay, attributes: firstDayAttributes } = useServerValue<DayOfWeek>(
    'data-vase-ui-first-day',
    () =>
      props.isoWeek === true || props.broadcastCalendar === true
        ? 1
        : (props.firstDayOfWeek ?? weekData.value.firstDay),
    (text) => {
      const days = parseDaysOfWeek(text);
      return days?.length === 1 ? days[0] : undefined;
    },
  );
  const minimalDays = computed(() =>
    props.isoWeek === true ? 4 : (props.firstWeekContainsDate ?? (firstDay.value === 1 ? 4 : 1)),
  );
  const { value: weekend, attributes: weekendAttributes } = useServerValue<readonly DayOfWeek[]>(
    'data-vase-ui-weekend',
    () => weekData.value.weekend,
    parseDaysOfWeek,
    (days) => days.join(' '),
  );
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

  const isMonthValue = computed(
    () => views !== undefined && isKind(selection.template.value, 'yearMonth'),
  );
  const viewState = useControlled<CalendarView | undefined>({
    controlled: () => views?.props.view,
    default: () => views?.props.defaultView,
    name: 'Calendar',
    state: 'view',
  });
  // A calendar of weeks or days shows days only, and a year and month has no days.
  const hasViews = computed(() => views !== undefined && duration.value === undefined);
  const view = computed<CalendarView>(() => {
    if (!hasViews.value) {
      return 'day';
    }
    const requested = viewState.value ?? 'day';
    return isMonthValue.value && requested === 'day' ? 'month' : requested;
  });
  const yearCount = computed(() => Math.max(1, Math.floor(views?.props.visibleYears ?? 12)));

  const timeZone = computed(() => {
    const template = selection.template.value;
    return (
      props.timeZone ??
      (template && isKind(template, 'zonedDateTime') ? template.timeZoneId : undefined)
    );
  });
  // The clock is read in `setup`, and again when the first page or the time zone changes. A page
  // that stays open for days then gets the right day when the user moves on. A server cannot know
  // the day of the visitor, so the first client render shows the day of the server HTML, and the
  // render after the mount shows the day of the browser.
  const clockDay = shallowRef(today(timeZone.value));
  const { value: shownClockDay, attributes: todayAttributes } = useServerValue(
    'data-vase-ui-today',
    () => clockDay.value,
    (text) => parseInputText(text, 'date') ?? undefined,
  );
  const todayDate = computed(() =>
    props.today === undefined ? shownClockDay.value : toPlainDate(props.today),
  );

  function toGridDate(date: DateValue | Temporal.PlainYearMonth) {
    return toPlainDate(date).withCalendar(calendar.value);
  }

  // The root picks the first page from this day until the month changes. It is a day and not a
  // month, because the calendar of the grid can change after the mount: the locale of the runtime
  // replaces `en-US`, and its calendar can have other months. After a hydration, the day of the
  // browser replaces the day of the server when the clock picked the page.
  const pageDay = props.focusedDate ?? props.defaultFocusedDate ?? selection.values.value[0];
  const initialDate = shallowRef(toPlainDate(pageDay ?? todayDate.value));

  const monthLimits = computed(() => ({
    min: props.minDate && monthOfDate(toGridDate(props.minDate)),
    max: props.maxDate && monthOfDate(toGridDate(props.maxDate)),
  }));

  const monthState = useControlled<Temporal.PlainYearMonth | undefined>({
    controlled: () => props.month,
    default: () => props.defaultMonth,
    name,
    state: 'month',
  });
  // The hook comes before the hook of `autoFocus`, so that `autoFocus` focuses the day of the
  // browser.
  onMounted(() => {
    if (
      pageDay === undefined &&
      monthState.value === undefined &&
      !initialDate.value.equals(todayDate.value)
    ) {
      initialDate.value = todayDate.value;
      keepFocusInGrid();
    }
  });
  // The limits apply only to a first page that the root picks. The root shows a month of the
  // consumer as it is: a change of a controlled `month` needs an event, and the mount emits none.
  const visibleMonth = computed(() =>
    monthState.value
      ? toGridDate(monthState.value).toPlainYearMonth()
      : clampMonth(
          toGridDate(initialDate.value).toPlainYearMonth(),
          view.value === 'day' ? undefined : 1,
        ),
  );

  const focusedDateState = useControlled<Temporal.PlainDate | null>({
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
      : toGridDate(initialDate.value);
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
    computed(() => `${calendar.value}|${firstDay.value}|${initialDate.value.toString()}`),
    computed(() => view.value === 'day'),
  );

  if (process.env.NODE_ENV !== 'production') {
    const names = computed(() => Object.keys(props.modifiers ?? {}));
    const check = (keys: string[]) => assertModifierNames(part, keys);
    check(names.value);
    watch(names, check);
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

  const dayTabStop = computed(() =>
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

  // The grid of months shows the months of one year, and the grid of years shows a page of years.
  // A cell is a month, or the first month of a year, and its day is the first day of that month.
  // The root focuses and registers a cell by that day.
  const monthCells = computed(() => getMonthCells(visibleMonth.value));
  const yearCells = computed(() => getYearCells(visibleMonth.value, yearCount.value));
  const todayMonth = computed(() => toGridDate(todayDate.value).toPlainYearMonth());
  const selectedMonths = computed(() =>
    selection.values.value.map((value) => toGridDate(value).toPlainYearMonth()),
  );

  function isMonthDisabled(month: Temporal.PlainYearMonth) {
    const { min, max } = monthLimits.value;
    return (
      props.disabled === true ||
      (min !== undefined && Temporal.PlainYearMonth.compare(month, min) < 0) ||
      (max !== undefined && Temporal.PlainYearMonth.compare(month, max) > 0) ||
      views?.props.disabledMonths?.(month) === true
    );
  }

  function isYearDisabled(year: Temporal.PlainYearMonth) {
    const { min, max } = monthLimits.value;
    return (
      props.disabled === true ||
      (min !== undefined && year.year < min.year) ||
      (max !== undefined && year.year > max.year) ||
      views?.props.disabledYears?.(year) === true
    );
  }

  function getMonthState(month: Temporal.PlainYearMonth): CalendarCellState {
    return {
      selected: selectedMonths.value.some((selected) => selected.equals(month)),
      disabled: isMonthDisabled(month),
      current: todayMonth.value.equals(month),
    };
  }

  function getYearState(year: Temporal.PlainYearMonth): CalendarCellState {
    return {
      selected: selectedMonths.value.some((selected) => selected.year === year.year),
      disabled: isYearDisabled(year),
      current: todayMonth.value.year === year.year,
    };
  }

  const getCellState = (cell: Temporal.PlainYearMonth) =>
    view.value === 'year' ? getYearState(cell) : getMonthState(cell);

  const cellDate = (cell: Temporal.PlainYearMonth) => cell.toPlainDate({ day: 1 });

  // The cell that holds `date`: its month, or the first month of its year.
  function cellOf(date: Temporal.PlainDate) {
    const month = date.toPlainYearMonth();
    return view.value === 'year' ? month.with({ month: 1 }) : month;
  }

  function isSameCell(a: Temporal.PlainYearMonth, b: Temporal.PlainYearMonth) {
    return view.value === 'year' ? a.year === b.year : a.equals(b);
  }

  const cellTabStop = computed(() => {
    const focused = focusedDateState.value;
    return getTabStop({
      days: (view.value === 'year' ? yearCells.value : monthCells.value)
        .filter((cell) => !getCellState(cell).disabled)
        .map(cellDate),
      focusedDate: focused ? cellDate(cellOf(toGridDate(focused))) : null,
      isSelected: (day) => getCellState(cellOf(day)).selected,
      today: cellDate(cellOf(toGridDate(todayDate.value))),
    });
  });

  const tabStop = computed(() => (view.value === 'day' ? dayTabStop.value : cellTabStop.value));

  const label = computed(() => {
    const locale = formatLocale.value;
    if (view.value === 'month') {
      return formatText(visibleMonth.value, { year: 'numeric' }, locale);
    }
    const first = yearCells.value[0];
    const last = yearCells.value.at(-1);
    if (view.value === 'year' && first && last) {
      return formatRangeText(first, last, { year: 'numeric' }, locale);
    }
    return formatPages(pages.value, locale);
  });

  function applyMonth(month: Temporal.PlainYearMonth, details: CalendarChangeEventDetails) {
    if (details.isCanceled) {
      return false;
    }
    emit('update:month', month);
    monthState.value = month;
    return true;
  }

  function setMonth(month: Temporal.PlainYearMonth, details: CalendarBaseChangeEventDetails) {
    emit('monthChange', month, details);
    return applyMonth(month, details);
  }

  function setMonthOfView(
    rootOptions: UseCalendarRootOptionsWithViews,
    month: Temporal.PlainYearMonth,
    details: CalendarChangeEventDetails,
  ) {
    rootOptions.emit('monthChange', month, details);
    return applyMonth(month, details);
  }

  // A page of a duration moves to the month of its first day: that month is the month of the root.
  function setPageStart(
    day: Temporal.PlainDate,
    details: CalendarBaseChangeEventDetails,
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

  function setFocusedDate(date: Temporal.PlainDate, details: CalendarBaseChangeEventDetails) {
    emit('focusedDateChange', date, details);
    if (details.isCanceled) {
      return false;
    }
    emit('update:focusedDate', date);
    focusedDateState.value = date;
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
  function showDate(date: Temporal.PlainDate, createDetails: () => CalendarBaseChangeEventDetails) {
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

  const dayElements = new Map<HTMLElement, string>();

  function getDayElement(key: string) {
    // A Vapor cell can mount in a cached branch before it receives a KeepAlive hook.
    return [...dayElements].findLast(([button, date]) => date === key && button.isConnected)?.[0];
  }

  function getDayKey(element: Element | null) {
    return [...dayElements].find(([button]) => button === element)?.[1];
  }

  const onPickerSelect = usePickerControl(PickerCalendarOwner, () => {
    const date = tabStop.value;
    return date ? getDayElement(toInputText(date, false)) : null;
  });

  function useFocusTarget(
    element: Readonly<Ref<HTMLElement | null>>,
    date: MaybeRefOrGetter<Temporal.PlainDate | null>,
    register?: (button: HTMLElement, day: Temporal.PlainDate) => () => void,
  ) {
    const { isHeld } = useKeepAliveState();
    watchPostEffect((onCleanup) => {
      const button = element.value;
      const day = toValue(date);
      if (!button || !day || isHeld.value) {
        return;
      }
      dayElements.set(button, toInputText(day, false));
      onCleanup(() => dayElements.delete(button));
      if (register) {
        onCleanup(register(button, day));
      }
    });
  }

  // The element of a day that the page shows now exists after the next flush.
  function focusDayElement(date: Temporal.PlainDate) {
    void nextTick().then(() => {
      getDayElement(toInputText(date, false))?.focus();
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
  function moveFocus(
    date: Temporal.PlainDate,
    createDetails: () => CalendarBaseChangeEventDetails,
  ) {
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

  // An element in an `inert` subtree cannot keep the focus. The browser thus moves the focus to
  // `<body>` when the page of the day that has the focus leaves.
  // The root decides after the flush, because a consumer can give the new month in that flush. A
  // consumer can also give the focus to another element then, and that focus stays.
  // The root focuses the tab stop only when the tab stop is the focused day, or when the day that
  // had the focus left the grid. Else the focus event would write the tab stop to the consumer in
  // place of the day that the consumer wrote.
  function keepFocusInGrid() {
    const [someDayElement] = dayElements.keys();
    const doc = ownerDocument(someDayElement);
    const focused = activeElement(doc);
    if (getDayKey(focused) === undefined) {
      return;
    }
    void nextTick().then(() => {
      const active = activeElement(doc);
      if (active !== focused && active !== doc.body && active !== null) {
        return;
      }
      const stop = tabStop.value;
      const focusedDateHasStop = stop && props.focusedDate && isSameDay(stop, props.focusedDate);
      if (focusedDateHasStop || getDayKey(active) === undefined) {
        focus();
      }
    });
  }

  // A new calendar or first day of the week gives the grid new elements, and the focus falls to
  // `<body>`. The data of the browser after the mount is an example. The day, month or year that
  // had the focus takes it again. When that cell left the grid, the cell that has the tab stop
  // takes the focus.
  watch([calendar, firstDay], () => {
    const [someDayElement] = dayElements.keys();
    const doc = ownerDocument(someDayElement);
    const focused = activeElement(doc);
    const key = getDayKey(focused);
    if (key === undefined) {
      return;
    }
    void nextTick().then(() => {
      const active = activeElement(doc);
      if (active !== doc.body && active !== null) {
        return;
      }
      const element = getDayElement(key);
      if (element === undefined) {
        focus();
      } else {
        element.focus();
      }
    });
  });

  // The watchers compare a text, because a consumer can give a new object for the same day or the
  // same month in each render.
  watch(
    () => props.focusedDate && toInputText(props.focusedDate, false),
    () => {
      if (props.focusedDate) {
        const date = clampDate(toGridDate(props.focusedDate));
        if (view.value !== 'day') {
          if (!isOnCellPage(cellOf(date))) {
            setMonth(
              clampMonth(date.toPlainYearMonth(), 1),
              createChangeEventDetails(REASONS.none),
            );
          }
        } else if (!isShown(date) && !isOwned(date)) {
          showDate(date, () => createChangeEventDetails(REASONS.none));
        }
      }
      keepFocusInGrid();
    },
  );
  watch(() => props.month?.toString(), keepFocusInGrid);
  watch(view, (next) => {
    // A grid of months or of years can show the month of `maxDate`. When the consumer shows the
    // days again, the pages of days then keep to the limits, as after a press on the trigger.
    const month = next === 'day' ? clampMonth(visibleMonth.value) : visibleMonth.value;
    if (!month.equals(visibleMonth.value)) {
      setMonth(month, createChangeEventDetails(REASONS.none));
    }
    // The grid that the focus was in is gone. The cell that has the tab stop in the new grid takes
    // it.
    keepFocusInGrid();
  });

  const canChange = () => props.readOnly !== true;

  function pressDay(date: Temporal.PlainDate, event: MouseEvent) {
    const state = getStateOfDate(date);
    if (canChange() && canSelect(state)) {
      const details = createChangeEventDetails(REASONS.dayPress, event);
      selection.press(date, details);
      if (!details.isCanceled) {
        onPickerSelect?.(event);
      }
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

  function setView(next: CalendarView, details: CalendarChangeEventDetails) {
    if (!views || !hasViews.value || next === view.value) {
      return false;
    }
    views.emit('viewChange', next, details);
    if (details.isCanceled) {
      return false;
    }
    views.emit('update:view', next);
    viewState.value = next;
    return true;
  }

  function toggleView(target: 'month' | 'year', event: MouseEvent) {
    if (!views) {
      return;
    }
    const next = view.value === target ? (isMonthValue.value ? 'month' : 'day') : target;
    const createDetails = () => createChangeEventDetails(REASONS.triggerPress, event);
    // A grid of months or of years can show the month of `maxDate`. The pages of days that follow
    // it then keep to the limits.
    const month = clampMonth(visibleMonth.value);
    if (
      next === 'day' &&
      !month.equals(visibleMonth.value) &&
      !setMonthOfView(views, month, createDetails())
    ) {
      return;
    }
    setView(next, createDetails());
  }

  // The day that a new focus in a grid of months or of years keeps: the focused day, else the first
  // selected day, else today.
  const focusBase = computed(() =>
    toGridDate(focusedDateState.value ?? selection.values.value[0] ?? todayDate.value),
  );

  // The day of a cell that the focus takes: the day of the month of the focused day, or the month of
  // the focused day in another year. A month with fewer days gives its last day.
  function dateOfCell(cell: Temporal.PlainYearMonth) {
    const base = focusBase.value;
    return view.value === 'year'
      ? base.add({ years: cell.year - base.year })
      : cell.toPlainDate({ day: Math.min(base.day, cell.daysInMonth) });
  }

  function isOnCellPage(cell: Temporal.PlainYearMonth) {
    return view.value === 'year'
      ? yearCells.value.some((year) => year.year === cell.year)
      : cell.year === visibleMonth.value.year;
  }

  // A cell of another page makes that page the page of the root. `date` is the day that the focus
  // takes in the cell.
  function moveCellFocus(
    cell: Temporal.PlainYearMonth,
    createDetails: () => CalendarBaseChangeEventDetails,
    date = dateOfCell(cell),
  ) {
    const target = clampDate(date);
    if (
      !isOnCellPage(cell) &&
      !setMonth(clampMonth(target.toPlainYearMonth(), 1), createDetails())
    ) {
      return false;
    }
    if (!setFocusedDate(target, createDetails())) {
      return false;
    }
    focusDayElement(cellDate(cell));
    return true;
  }

  function onCellFocus(cell: Temporal.PlainYearMonth, event: FocusEvent) {
    const focused = focusedDateState.value;
    if (!focused || !isSameCell(cellOf(toGridDate(focused)), cell)) {
      setFocusedDate(clampDate(dateOfCell(cell)), createChangeEventDetails(REASONS.none, event));
    }
  }

  function onCellKeydown(cell: Temporal.PlainYearMonth, columns: number, event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return;
    }
    const move = getGridMove(event.key, { isRtl: direction.value === 'rtl', columns });
    if (!move) {
      return;
    }
    event.preventDefault();
    const target = findGridTarget(cell, move, {
      unit: view.value === 'year' ? 'year' : 'month',
      columns,
      visibleYears: yearCount.value,
      canFocus: (candidate) => !getCellState(candidate).disabled,
      min: monthLimits.value.min,
      max: monthLimits.value.max,
    });
    if (target) {
      moveCellFocus(target, () => createChangeEventDetails(REASONS.keyboard, event));
    }
  }

  // A press on a month of a year and month selects it. Else it shows the days of the month.
  function pressMonth(month: Temporal.PlainYearMonth, event: MouseEvent) {
    if (!views || isMonthDisabled(month)) {
      return;
    }
    if (isMonthValue.value) {
      if (canChange()) {
        const details = createChangeEventDetails(REASONS.monthPress, event);
        views.selection.press(cellDate(month), details);
        if (!details.isCanceled) {
          onPickerSelect?.(event);
        }
      }
      return;
    }
    const target = clampMonth(month);
    if (
      target.equals(visibleMonth.value) ||
      setMonthOfView(views, target, createChangeEventDetails(REASONS.monthPress, event))
    ) {
      setView('day', createChangeEventDetails(REASONS.monthPress, event));
    }
  }

  // A press on a year shows its months, in the same month of the year as the root has now.
  function pressYear(year: Temporal.PlainYearMonth, event: MouseEvent) {
    if (!views || isYearDisabled(year)) {
      return;
    }
    const target = clampMonth(
      visibleMonth.value.add({ years: year.year - visibleMonth.value.year }),
      1,
    );
    if (
      target.equals(visibleMonth.value) ||
      setMonthOfView(views, target, createChangeEventDetails(REASONS.yearPress, event))
    ) {
      setView('month', createChangeEventDetails(REASONS.yearPress, event));
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
    if (view.value !== 'day') {
      const cell = cellOf(target);
      if (!getCellState(cell).disabled) {
        moveCellFocus(cell, () => createChangeEventDetails(REASONS.none), target);
      }
      return;
    }
    if (canFocus(getStateOfDate(target))) {
      moveFocus(target, () => createChangeEventDetails(REASONS.none));
    }
  }

  const navigationStep = computed(() => {
    if (view.value !== 'day') {
      return { unit: 'years' as const, count: view.value === 'year' ? yearCount.value : 1 };
    }
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

  // The days that the grid of months or of years covers: the years of its page.
  const yearSpan = computed(() => {
    const years = view.value === 'year' ? yearCells.value : [visibleMonth.value];
    const first = years[0] ?? visibleMonth.value;
    return getSpanOfYears(first, years.at(-1) ?? first);
  });

  const canPrevious = computed(() => {
    const first = view.value === 'day' ? pages.value[0]?.first : yearSpan.value.first;
    return (
      first !== undefined && (props.minDate === undefined || compareDates(first, props.minDate) > 0)
    );
  });
  const canNext = computed(() => {
    const last = view.value === 'day' ? pages.value.at(-1)?.last : yearSpan.value.last;
    return (
      last !== undefined && (props.maxDate === undefined || compareDates(last, props.maxDate) < 0)
    );
  });

  // When too few months fit between the limits, the last page must include `maxDate`.
  function clampMonth(
    month: Temporal.PlainYearMonth,
    pageMonths = duration.value ? 1 : monthCount.value,
  ) {
    const { min, max } = monthLimits.value;
    const last = max?.subtract({ months: pageMonths - 1 });
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
    if (view.value !== 'day') {
      const target = clampMonth(
        visibleMonth.value.add({ years: step * navigationStep.value.count }),
        1,
      );
      return (
        !target.equals(visibleMonth.value) && setMonth(target, createDetails()) && canContinue()
      );
    }
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
    hydrationAttributes: () => ({
      ...(props.today === undefined && todayAttributes()),
      ...calendarAttributes(),
      ...firstDayAttributes(),
      ...weekendAttributes(),
    }),
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
    getWeekNumber: (week: CalendarPageWeek) =>
      getWeekNumber(week.start, firstDay.value, minimalDays.value),
    toGridDate,
    pressDay,
    onDayFocus,
    onDayKeydown,
    useFocusTarget,
    focus,
    view,
    hasViews,
    selectsMonths: isMonthValue,
    monthCells,
    yearCells,
    toggleView,
    getMonthState,
    getYearState,
    pressMonth,
    pressYear,
    onCellFocus,
    onCellKeydown,
  };
}

interface TabStopOptions {
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
type KeyMove =
  { weekEdge: 'start' | 'end' } | { duration: Temporal.DurationLike; stepDays: number };

interface KeyAction {
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

/** A cell of the grid of months is a month, and a cell of the grid of years is its first month. */
type GridUnit = 'month' | 'year';

/**
 * A move of the focus that a key makes in a grid of months or years: by cells, to the first or last
 * cell of the row, or by pages. A page is a year in the grid of months, and the years of a page in
 * the grid of years. The sign is the direction.
 */
export type GridMove = { cells: number } | { rowEdge: 'start' | 'end' } | { pages: number };

/**
 * The move of a key in a grid, or `null` for a key that the grid does not handle.
 * @param isRtl Left and right swap in a right-to-left page.
 * @param columns The cells of a row. Up and down move by a row.
 */
export function getGridMove(
  key: string,
  { isRtl, columns }: { isRtl: boolean; columns: number },
): GridMove | null {
  const horizontal = isRtl ? -1 : 1;
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

export interface GridTargetOptions {
  unit: GridUnit;
  /** The cells of a row. */
  columns: number;
  /** The years of a page of years. */
  visibleYears: number;
  canFocus: (cell: Temporal.PlainYearMonth) => boolean;
  /** The first and the last month that the limits allow. A year cell is out when its year is out. */
  min: Temporal.PlainYearMonth | undefined;
  max: Temporal.PlainYearMonth | undefined;
}

function compare(unit: GridUnit, a: Temporal.PlainYearMonth, b: Temporal.PlainYearMonth) {
  return unit === 'month' ? Temporal.PlainYearMonth.compare(a, b) : a.year - b.year;
}

function stepBy(unit: GridUnit, cell: Temporal.PlainYearMonth, count: number) {
  return unit === 'month' ? cell.add({ months: count }) : cell.add({ years: count });
}

// The cell of a limit: the month itself, or the first month of its year.
function toCell(unit: GridUnit, month: Temporal.PlainYearMonth) {
  return unit === 'month' ? month : month.with({ month: 1 });
}

/**
 * The cell that a move of the focus reaches, or `null` when the focus stays. The move never stops
 * on a cell that cannot take focus. It goes on in its direction to the next cell that can, and it
 * stops at `min` and `max`. A move to the edge of a row stops at the first cell of the row that
 * can take focus, and the focused cell is the last one that it tries.
 */
export function findGridTarget(
  from: Temporal.PlainYearMonth,
  move: GridMove,
  { unit, columns, visibleYears, canFocus, min, max }: GridTargetOptions,
): Temporal.PlainYearMonth | null {
  if ('rowEdge' in move) {
    const index =
      unit === 'month' ? from.month - 1 : from.year - getYearPageStart(from.year, visibleYears);
    const count = unit === 'month' ? from.monthsInYear : visibleYears;
    const rowStart = index - (index % columns);
    const edge = move.rowEdge === 'start' ? rowStart : Math.min(rowStart + columns, count) - 1;
    const direction = move.rowEdge === 'start' ? 1 : -1;
    for (let offset = edge - index; offset * direction <= 0; offset += direction) {
      const cell = stepBy(unit, from, offset);
      if (canFocus(cell)) {
        return cell.equals(from) ? null : cell;
      }
    }
    return null;
  }

  const direction = 'cells' in move ? move.cells : move.pages;
  let candidate =
    'cells' in move
      ? stepBy(unit, from, move.cells)
      : from.add({ years: unit === 'month' ? move.pages : move.pages * visibleYears });
  if (min && compare(unit, candidate, min) < 0) {
    candidate = toCell(unit, min);
  }
  if (max && compare(unit, candidate, max) > 0) {
    candidate = toCell(unit, max);
  }
  for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
    if (canFocus(candidate)) {
      return candidate.equals(from) ? null : candidate;
    }
    candidate = stepBy(unit, candidate, Math.sign(direction));
    const isBeyondMin = direction < 0 && min && compare(unit, candidate, min) < 0;
    const isBeyondMax = direction > 0 && max && compare(unit, candidate, max) > 0;
    if (isBeyondMin || isBeyondMax) {
      return null;
    }
  }
  return null;
}

/** The weeks or the days that one page of a calendar shows, in place of a month. */
export type VisibleDuration = { weeks: number } | { days: number };

const BROADCAST_FIRST_DAY = 1;
const BROADCAST_FIXED_WEEKS = 5;

/**
 * The number of the week that holds `date`. The first week of a year is the first week that has
 * `minimalDays` days in that year, so that the day `minimalDays` of January is always in it. With
 * Monday as `firstDay` and `4`, the number is the ISO 8601 number. A week of the days at the end of
 * a year can have the number of the first week of the next year.
 * `Intl` has no data for the first week, and `Temporal` gives a week number only in the ISO
 * calendar, so the number is read from the ISO date of `date`.
 */
export function getWeekNumber(
  date: Temporal.PlainDate,
  firstDay: DayOfWeek,
  minimalDays: number,
): number {
  const iso = date.withCalendar('iso8601');
  const week = startOfWeek(iso, firstDay);
  const firstWeekOf = (year: number) =>
    startOfWeek(Temporal.PlainDate.from({ year, month: 1, day: minimalDays }), firstDay);

  const nextYear = firstWeekOf(iso.year + 1);
  const thisYear = firstWeekOf(iso.year);
  const firstWeek =
    compareDates(week, nextYear) >= 0
      ? nextYear
      : compareDates(week, thisYear) >= 0
        ? thisYear
        : firstWeekOf(iso.year - 1);
  return firstWeek.until(week, { largestUnit: 'days' }).days / 7 + 1;
}

/**
 * The page of a broadcast month. It starts on the Monday of the week that holds the first day of
 * the month, and it ends on the Sunday before the first Monday of the next broadcast month, so it
 * has 4 or 5 weeks. With `fixedWeeks`, it has 5 weeks. `yearMonth` must be in the ISO calendar.
 */
export function getBroadcastPage(
  yearMonth: Temporal.PlainYearMonth,
  fixedWeeks = false,
): CalendarPage {
  const start = startOfWeek(yearMonth.toPlainDate({ day: 1 }), BROADCAST_FIRST_DAY);
  const next = startOfWeek(
    yearMonth.add({ months: 1 }).toPlainDate({ day: 1 }),
    BROADCAST_FIRST_DAY,
  );
  const length = fixedWeeks
    ? BROADCAST_FIXED_WEEKS
    : start.until(next, { largestUnit: 'days' }).days / 7;
  const weeks = Array.from({ length }, (_, index) => createWeek(start.add({ weeks: index })));
  return {
    start,
    end: start.add({ days: length * 7 - 1 }),
    first: start,
    last: next.subtract({ days: 1 }),
    yearMonth,
    isDuration: false,
    weekdays: weekdaysFrom(BROADCAST_FIRST_DAY),
    weeks,
  };
}

/**
 * The page of a duration. `start` is its first day: a day of `firstDay` for weeks. Days are one row.
 * `yearMonth` is the month of the root, which a select of the page shows.
 */
export function getDurationPage(
  start: Temporal.PlainDate,
  duration: VisibleDuration,
  yearMonth: Temporal.PlainYearMonth,
): CalendarPage {
  const weeks =
    'weeks' in duration
      ? Array.from({ length: duration.weeks }, (_, index) =>
          createWeek(start.add({ weeks: index })),
        )
      : [createWeek(start, duration.days)];
  const end = start.add({ days: ('weeks' in duration ? duration.weeks * 7 : duration.days) - 1 });
  return {
    start,
    end,
    first: start,
    last: end,
    yearMonth,
    isDuration: true,
    weekdays: weeks[0]?.days.map((day) => dayOfWeekOf(day)) ?? [],
    weeks,
  };
}

/**
 * The first day of the page of a duration that shows `date`. A page that starts at its edge moves
 * the least: forward, `date` is in the first week or the first day. Backward, it is in the last.
 */
export function alignPageStart(
  date: Temporal.PlainDate,
  duration: VisibleDuration,
  firstDay: DayOfWeek,
  edge: 'start' | 'end',
): Temporal.PlainDate {
  if ('weeks' in duration) {
    const week = startOfWeek(date, firstDay);
    return edge === 'start' ? week : week.subtract({ weeks: duration.weeks - 1 });
  }
  return edge === 'start' ? date : date.subtract({ days: duration.days - 1 });
}

/** The side of the last change of the page: `none` until the page changes after the mount. */
export type NavigationDirection = 'previous' | 'next' | 'none';

/**
 * The side of the last change of the pages, and the pages that left. A page that left stays in
 * `renderedPages` until its animations end, so that the part can play the exit.
 *
 * A change of `layoutKey` gives other pages for the same place of the calendar: the runtime locale
 * has another first day of the week, or another calendar, than the locale of a server. After a
 * hydration, the first page also changes when the clock of the browser gives another day than the
 * clock of the server. A new layout drops outgoing pages and keeps the last navigation direction.
 *
 * Only the pages of days move, so `isEnabled` is `false` while the grid shows months or years. No
 * page leaves then, because no `Calendar.Month` is there to end its animation. The side is `none`.
 *
 * The watcher is synchronous, so a page is in `renderedPages` in the render that removes it from
 * `pages`.
 */
export function usePageTransition(
  pages: Readonly<Ref<CalendarPage[]>>,
  layoutKey: Readonly<Ref<string>>,
  isEnabled: Readonly<Ref<boolean>>,
) {
  const navigationDirection = shallowRef<NavigationDirection>('none');
  const leaving = shallowRef<CalendarPage[]>([]);

  watch(
    [pages, layoutKey, isEnabled],
    ([next, layout, enabled], [previous, previousLayout]) => {
      if (!enabled || layout !== previousLayout) {
        leaving.value = [];
        if (!enabled) {
          navigationDirection.value = 'none';
        }
        return;
      }

      const first = next[0];
      const wasFirst = previous[0];
      if (first && wasFirst && compareDates(first.first, wasFirst.first) !== 0) {
        navigationDirection.value =
          compareDates(first.first, wasFirst.first) < 0 ? 'previous' : 'next';
      }
      const shown = new Set(next.map((page) => getPageKey(page)));
      leaving.value = [...leaving.value, ...previous].filter(
        (page) => !shown.has(getPageKey(page)),
      );
    },
    { flush: 'sync' },
  );

  const renderedPages = computed(() =>
    [...pages.value, ...leaving.value].sort((a, b) => compareDates(a.first, b.first)),
  );

  return {
    navigationDirection: readonly(navigationDirection),
    renderedPages,
    isLeaving: (page: CalendarPage) =>
      leaving.value.some((left) => getPageKey(left) === getPageKey(page)),
    finishLeaving: (page: CalendarPage) => {
      leaving.value = leaving.value.filter((left) => getPageKey(left) !== getPageKey(page));
    },
  };
}
