import { expectType } from '#test-utils';
import * as RangeCalendar from '../index.parts';

const date = Temporal.PlainDate.from('2026-11-14');
const dateTime = Temporal.PlainDateTime.from('2026-11-14T09:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]');

// A range gives the type that it got.
<RangeCalendar.Root
  value={[date, null]}
  onValueChange={(value, details) => {
    expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
    expectType<RangeCalendar.Root.ChangeEventDetails, typeof details>(details);
  }}
  {...{
    'onUpdate:value': (value: [Temporal.PlainDate | null, Temporal.PlainDate | null]) => {
      expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
    },
  }}
/>;

<RangeCalendar.Root
  defaultValue={[dateTime, dateTime]}
  onValueChange={(value) => {
    expectType<[Temporal.PlainDateTime | null, Temporal.PlainDateTime | null], typeof value>(value);
  }}
/>;

<RangeCalendar.Root
  value={[zoned, null]}
  onValueChange={(value) => {
    expectType<[Temporal.ZonedDateTime | null, Temporal.ZonedDateTime | null], typeof value>(value);
  }}
/>;

// A calendar with no value gives dates.
<RangeCalendar.Root
  onValueChange={(value) => {
    expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
  }}
/>;

// An empty range has two null ends.
<RangeCalendar.Root value={[null, null]} />;

// @ts-expect-error A range is a list of two ends.
<RangeCalendar.Root value={date} />;

// @ts-expect-error A range has two ends, and no more.
<RangeCalendar.Root value={[date, date, date]} />;

// @ts-expect-error The value of a calendar is a date, not a time.
<RangeCalendar.Root value={[Temporal.PlainTime.from('09:30'), null]} />;

// The props that the range adds, and the props of the calendar.
<RangeCalendar.Root
  minDays={2}
  maxDays={7}
  allowNonContiguousRanges
  numberOfMonths={2}
  disabledDates={[date, { dayOfWeek: [6, 7] }]}
  unavailableDates={{ before: date }}
  minDate={zoned}
  maxDate={dateTime}
  today={date}
  timeZone="Asia/Tokyo"
  locale="fr"
  calendar="persian"
  month={Temporal.PlainYearMonth.from('2026-11')}
  focusedDate={date}
  onMonthChange={(month, details) => {
    expectType<Temporal.PlainYearMonth, typeof month>(month);
    expectType<'day-press' | 'drag' | 'keyboard' | 'month-change' | 'none', typeof details.reason>(
      details.reason,
    );
  }}
/>;

// @ts-expect-error The least number of days is a number.
<RangeCalendar.Root minDays="2" />;

const rootState: RangeCalendar.Root.State = {
  disabled: false,
  readOnly: false,
  invalid: false,
  empty: true,
  multipleMonths: false,
  navigationDirection: 'none',
  broadcastCalendar: false,
  selecting: false,
};
const dayState: RangeCalendar.Day.State = {
  selected: false,
  disabled: false,
  unavailable: false,
  hidden: false,
  today: false,
  outsideMonth: false,
  weekend: false,
  modifiers: {},
  rangeStart: false,
  rangeEnd: false,
  rangeMiddle: false,
};
const buttonState: RangeCalendar.DayButton.State = dayState;
const range: RangeCalendar.Root.Value = [date, null];

// The parts of Calendar that the range calendar exports again.
const weekday: RangeCalendar.Weekday.Props = { weekday: 1, format: 'narrow' };
const caption: RangeCalendar.Caption.Props = { format: { month: 'short' } };
