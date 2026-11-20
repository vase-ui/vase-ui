import { expectType } from '#test-utils';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';

declare const day: Temporal.PlainDate;
declare const dateTime: Temporal.PlainDateTime;
declare const zoned: Temporal.ZonedDateTime;

// The type of the range that the picker gives follows the range that the parent gives.
<DateRangePicker.Root
  modelValue={[day, day]}
  onValueChange={(value) => {
    expectType<[Temporal.PlainDate | null, Temporal.PlainDate | null], typeof value>(value);
  }}
/>;
<DateRangePicker.Root
  defaultValue={[dateTime, null]}
  onValueChange={(value) => {
    expectType<[Temporal.PlainDateTime | null, Temporal.PlainDateTime | null], typeof value>(value);
  }}
/>;
<DateRangePicker.Root
  defaultValue={[null, zoned]}
  onValueChange={(value) => {
    expectType<[Temporal.ZonedDateTime | null, Temporal.ZonedDateTime | null], typeof value>(value);
  }}
/>;
<DateRangePicker.Root modelValue={null} />;
<DateRangePicker.Root modelValue={[null, null]} />;

// @ts-expect-error a plain `Date` is not an end of the range
<DateRangePicker.Root modelValue={[new Date(), null]} />;
// @ts-expect-error a time has no date
<DateRangePicker.Root modelValue={[Temporal.PlainTime.from('15:04'), null]} />;
// @ts-expect-error a year and month is not a day
<DateRangePicker.Root modelValue={[Temporal.PlainYearMonth.from('2026-11'), null]} />;
// @ts-expect-error a range has two ends
<DateRangePicker.Root modelValue={[day]} />;
// @ts-expect-error `minDate` is a `Temporal` value
<DateRangePicker.Root minDate={new Date()} />;

function assertValueChange(details: DateRangePicker.Root.ChangeEventDetails) {
  // The picker gives the details of a field, a clock or a calendar with no change.
  const event: Event = details.event;
  void event;
}

void assertValueChange;

// The details of an open change have the reasons of the popover, and a way to keep the popup.
function assertOpenChange(details: DateRangePicker.Root.OpenChangeEventDetails) {
  expectType<
    | 'trigger-hover'
    | 'trigger-focus'
    | 'trigger-press'
    | 'outside-press'
    | 'escape-key'
    | 'close-press'
    | 'focus-out'
    | 'imperative-action'
    | 'none',
    DateRangePicker.Root.OpenChangeEventDetails['reason']
  >(details.reason);
}

void assertOpenChange;

// The granularity is a unit of the day or the time. A range has no month granularity.
const granularity: DateRangePicker.Root.Granularity = 'second';
void granularity;
// @ts-expect-error a range picker has no `month` granularity
const invalidGranularity: DateRangePicker.Root.Granularity = 'month';
void invalidGranularity;

// The type of the value of the root is the two ends.
declare const value: DateRangePicker.Root.Value;
expectType<
  [
    Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | null,
    Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | null,
  ],
  typeof value
>(value);

// The actions are those of the popover.
declare const actions: DateRangePicker.Root.Actions;
expectType<() => void, typeof actions.close>(actions.close);
