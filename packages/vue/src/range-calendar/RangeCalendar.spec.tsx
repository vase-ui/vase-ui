import { expectType } from '#test-utils';
import { Calendar } from '@vase-ui/vue/calendar';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
import type { RangeCalendarRootValue } from '@vase-ui/vue/range-calendar';

const date = Temporal.PlainDate.from('2026-11-14');
const dateTime = Temporal.PlainDateTime.from('2026-11-14T09:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]');

// A range gives the type that it got.
<RangeCalendar.Root
  modelValue={[date, null]}
  onValueChange={(value, details) => {
    expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
    expectType<RangeCalendar.Root.ChangeEventDetails, typeof details>(details);
  }}
  {...{
    'onUpdate:modelValue': (value: [Temporal.PlainDate | null, Temporal.PlainDate | null]) => {
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
  modelValue={[zoned, null]}
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
<RangeCalendar.Root modelValue={[null, null]} />;

// @ts-expect-error A range is a list of two ends.
<RangeCalendar.Root modelValue={date} />;

// @ts-expect-error A range has two ends, and no more.
<RangeCalendar.Root modelValue={[date, date, date]} />;

// @ts-expect-error The value of a calendar is a date, not a time.
<RangeCalendar.Root modelValue={[Temporal.PlainTime.from('09:30'), null]} />;

// The props that the range adds, and the props of the calendar.
<RangeCalendar.Root
  minDays={2}
  maxDays={7}
  allowNonContiguousRanges
  numberOfMonths={2}
  disabledDates={[date, { dayOfWeek: [6, 7] }]}
  unavailableDates={{ before: date }}
  min={zoned}
  max={dateTime}
  today={date}
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

// A range calendar has no views, so no event has the reason of a press on a month, a year or the
// view trigger.
const changeReason = null as unknown as RangeCalendar.Root.ChangeEventReason;
expectType<'day-press' | 'drag' | 'keyboard' | 'month-change' | 'none', typeof changeReason>(
  changeReason,
);

<RangeCalendar.Root
  onFocusedDateChange={(focusedDate, details) => {
    expectType<Temporal.PlainDate, typeof focusedDate>(focusedDate);
    expectType<RangeCalendar.Root.ChangeEventDetails, typeof details>(details);
  }}
/>;

// @ts-expect-error The least number of days is a number.
<RangeCalendar.Root minDays="2" />;

const rootState: RangeCalendar.Root.State = {
  disabled: false,
  readonly: false,
  invalid: false,
  empty: true,
  view: 'day',
  multipleMonths: false,
  navigationDirection: 'none',
  broadcastCalendar: false,
  selecting: false,
};
const range: RangeCalendar.Root.Value = [date, null];
const flatRange: RangeCalendarRootValue = range;

// A range root shows the parts of Calendar, and it has no part of its own but its root.
<RangeCalendar.Root>
  <Calendar.Months />
</RangeCalendar.Root>;

// @ts-expect-error The parts of a range are the parts of Calendar.
<RangeCalendar.Day />;
