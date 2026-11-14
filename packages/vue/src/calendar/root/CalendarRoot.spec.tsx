import { expectType } from '#test-utils';
import * as Calendar from '../index.parts';

const date = Temporal.PlainDate.from('2026-11-14');
const dateTime = Temporal.PlainDateTime.from('2026-11-14T09:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]');

// A single calendar gives the type that it got.
<Calendar.Root
  value={date}
  onValueChange={(value, details) => {
    expectType<Temporal.PlainDate, typeof value>(value);
    expectType<Calendar.Root.ChangeEventDetails, typeof details>(details);
  }}
  {...{
    'onUpdate:value': (value: Temporal.PlainDate) => {
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
  value={zoned}
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
<Calendar.Root value={null as Temporal.PlainDate | null} />;

// With `multiple`, the value is a list, and the event gives a list.
<Calendar.Root
  multiple
  value={[date]}
  minDays={1}
  maxDays={3}
  onValueChange={(value) => {
    expectType<Temporal.PlainDate[], typeof value>(value);
  }}
/>;

// @ts-expect-error A list needs `multiple`.
<Calendar.Root value={[date]} />;

// @ts-expect-error A single value cannot be a list.
<Calendar.Root multiple value={date} />;

// @ts-expect-error The value of a calendar is a date, not a time.
<Calendar.Root value={Temporal.PlainTime.from('09:30')} />;

<Calendar.Root
  month={Temporal.PlainYearMonth.from('2026-11')}
  onMonthChange={(month, details) => {
    expectType<Temporal.PlainYearMonth, typeof month>(month);
    expectType<'day-press' | 'keyboard' | 'none', typeof details.reason>(details.reason);
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
  minDate={zoned}
  maxDate={dateTime}
  today={date}
  firstDayOfWeek={1}
  timeZone="Asia/Tokyo"
  locale="fr"
  calendar="persian"
/>;

// @ts-expect-error The first day of the week is from 1 to 7.
<Calendar.Root firstDayOfWeek={0} />;

const rootProps: Calendar.Root.Props = { value: date };
const rootState: Calendar.Root.State = {
  disabled: false,
  readOnly: false,
  invalid: false,
  empty: true,
};
const weekday: Calendar.Weekday.Props = { weekday: 1, format: 'narrow' };
const dayState: Calendar.Day.State = {
  selected: false,
  disabled: false,
  unavailable: false,
  hidden: false,
  today: false,
  outsideMonth: false,
  weekend: false,
};
