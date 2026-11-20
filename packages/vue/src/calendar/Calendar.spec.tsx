import { expectType } from '#test-utils';
import { Calendar } from '@vase-ui/vue/calendar';
import type { CalendarDayState, CalendarRootChangeEventDetails } from '@vase-ui/vue/calendar';

const date = Temporal.PlainDate.from('2026-11-14');
const dateTime = Temporal.PlainDateTime.from('2026-11-14T09:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]');

// A single calendar gives the type that it got.
<Calendar.Root
  modelValue={date}
  onValueChange={(value, details) => {
    expectType<Temporal.PlainDate, typeof value>(value);
    expectType<Calendar.Root.ChangeEventDetails, typeof details>(details);
    expectType<CalendarRootChangeEventDetails, typeof details>(details);
  }}
  {...{
    'onUpdate:modelValue': (value: Temporal.PlainDate) => {
      expectType<Temporal.PlainDate, typeof value>(value);
    },
  }}
/>;

<Calendar.Root
  defaultValue={dateTime}
  onValueChange={(value) => {
    expectType<Temporal.PlainDateTime, typeof value>(value);
  }}
/>;

<Calendar.Root
  modelValue={zoned}
  onValueChange={(value) => {
    expectType<Temporal.ZonedDateTime, typeof value>(value);
  }}
/>;

// A calendar with no value gives a date.
<Calendar.Root
  onValueChange={(value) => {
    expectType<Temporal.PlainDate, typeof value>(value);
  }}
/>;

// A value of null is an empty selection.
<Calendar.Root modelValue={null as Temporal.PlainDate | null} />;

// With `multiple`, the value is a list, and the event gives a list.
<Calendar.Root
  multiple
  modelValue={[date]}
  minDays={1}
  maxDays={3}
  onValueChange={(value) => {
    expectType<Temporal.PlainDate[], typeof value>(value);
  }}
/>;

// @ts-expect-error A list needs `multiple`.
<Calendar.Root modelValue={[date]} />;

// @ts-expect-error A single value cannot be a list.
<Calendar.Root multiple modelValue={date} />;

// @ts-expect-error The value of a calendar is a date, not a time.
<Calendar.Root modelValue={Temporal.PlainTime.from('09:30')} />;

<Calendar.Root
  month={Temporal.PlainYearMonth.from('2026-11')}
  onMonthChange={(month, details) => {
    expectType<Temporal.PlainYearMonth, typeof month>(month);
    expectType<
      | 'day-press'
      | 'month-press'
      | 'year-press'
      | 'trigger-press'
      | 'keyboard'
      | 'month-change'
      | 'none',
      typeof details.reason
    >(details.reason);
  }}
  focusedDate={date}
  onFocusedDateChange={(focused) => {
    expectType<Temporal.PlainDate, typeof focused>(focused);
  }}
/>;

// A matcher has a form of the matchers, and a day of the week is a number.
<Calendar.Root
  disabledDates={[date, { start: date, end: date }, { dayOfWeek: [6, 7] }, (day) => day.day === 1]}
  unavailableDates={{ before: date }}
  hiddenDates={{ after: dateTime }}
  modifiers={{ holiday: date, work: { dayOfWeek: 1 } }}
  min={zoned}
  max={dateTime}
  today={date}
  firstDayOfWeek={1}
  locale="fr"
  calendar="persian"
/>;

// @ts-expect-error The first day of the week is from 1 to 7.
<Calendar.Root firstDayOfWeek={0} />;

const rootProps: Calendar.Root.Props = { modelValue: date };
const rootState: Calendar.Root.State = {
  disabled: false,
  readonly: false,
  invalid: false,
  empty: true,
  view: 'day',
  multipleMonths: false,
  navigationDirection: 'none',
  broadcastCalendar: false,
};
const weekday: Calendar.Weekday.Props = { weekday: 1, format: 'narrow' };
const dayState: Calendar.Day.State = {
  selected: false,
  disabled: false,
  unavailable: false,
  hidden: false,
  today: false,
  outsideMonth: false,
  rangeStart: false,
  rangeEnd: false,
  rangeMiddle: false,
  modifiers: { holiday: true },
};
const flatDayState: CalendarDayState = dayState;

// The pages: months, a broadcast month, and a duration of weeks or days.
<Calendar.Root
  numberOfMonths={2}
  pagedNavigation
  fixedWeeks
  showOutsideDays
  firstWeekContainsDate={4}
  broadcastCalendar
  visibleDuration={{ weeks: 2 }}
/>;
<Calendar.Root visibleDuration={{ days: 5 }} />;

// @ts-expect-error A duration has weeks or days.
<Calendar.Root visibleDuration={{ months: 1 }} />;

// @ts-expect-error The day of January is from 1 to 7.
<Calendar.Root firstWeekContainsDate={8} />;

const monthsState: Calendar.Months.State = { ...rootState, navigationDirection: 'next' };
const captionProps: Calendar.Caption.Props = { id: 'caption', format: { month: 'short' } };
const monthSelectProps: Calendar.MonthSelect.Props = { format: 'short' };
const yearSelectProps: Calendar.YearSelect.Props = { format: '2-digit', order: 'desc' };
const weekNumberProps: Calendar.WeekNumber.Props = {
  week: { start: date, days: [date] },
};
const weekNumberState: Calendar.WeekNumber.State = { ...rootState, weekNumber: 45 };
const buttonProps: Calendar.PreviousButton.Props = { disabled: true, as: 'span' };

// @ts-expect-error A part reads the element that it renders.
const nativeButton: Calendar.PreviousButton.Props = { nativeButton: false };

// @ts-expect-error The order of the years is asc or desc.
const yearOrder: Calendar.YearSelect.Props = { order: 'random' };

// A year and month is a value too. It gives back the kind that it got, single or in a list.
const yearMonth = Temporal.PlainYearMonth.from('2026-11');

<Calendar.Root
  modelValue={yearMonth}
  onValueChange={(value) => {
    expectType<Temporal.PlainYearMonth, typeof value>(value);
  }}
/>;

<Calendar.Root
  multiple
  defaultValue={[yearMonth]}
  onValueChange={(value) => {
    expectType<Temporal.PlainYearMonth[], typeof value>(value);
  }}
/>;

// @ts-expect-error A time is not a value of a calendar.
<Calendar.Root modelValue={Temporal.PlainTime.from('09:30')} />;

// The views, and the functions that disable a month or a year.
<Calendar.Root
  view="year"
  defaultView="month"
  visibleYears={5}
  disabledMonths={(month) => month.month === 2}
  disabledYears={(year) => year.year % 2 === 0}
  onViewChange={(view, details) => {
    expectType<Calendar.Root.View, typeof view>(view);
    expectType<Calendar.Root.ChangeEventDetails, typeof details>(details);
  }}
  {...{
    'onUpdate:view': (view: Calendar.Root.View) => {
      expectType<'day' | 'month' | 'year', typeof view>(view);
    },
  }}
/>;

// @ts-expect-error A view is the days, the months or the years.
<Calendar.Root view="week" />;

const viewTriggerProps: Calendar.ViewTrigger.Props = { view: 'month', disabled: true };
const viewTriggerState: Calendar.ViewTrigger.State = {
  disabled: false,
  readonly: false,
  invalid: false,
  empty: true,
  view: 'year',
  active: false,
};
const monthGridProps: Calendar.MonthGrid.Props = { columns: 4 };
const monthCellProps: Calendar.MonthCell.Props = { month: yearMonth, format: 'long' };
const monthCellState: Calendar.MonthCell.State = { selected: true, disabled: false, current: true };
const yearGridProps: Calendar.YearGrid.Props = { columns: 4 };
const yearCellProps: Calendar.YearCell.Props = { year: yearMonth, format: '2-digit' };

// @ts-expect-error A month cell has a month.
const missingMonth: Calendar.MonthCell.Props = {};

// @ts-expect-error The format of a year is numeric or 2-digit.
const longYear: Calendar.YearCell.Props = { year: yearMonth, format: 'long' };

// @ts-expect-error A trigger shows the months or the years.
const dayTrigger: Calendar.ViewTrigger.Props = { view: 'day' };
