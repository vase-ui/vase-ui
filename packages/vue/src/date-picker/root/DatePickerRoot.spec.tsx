import { expectType } from '#test-utils';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { REASONS } from '../../internals/reasons';

declare const day: Temporal.PlainDate;
declare const dateTime: Temporal.PlainDateTime;
declare const zoned: Temporal.ZonedDateTime;
declare const month: Temporal.PlainYearMonth;

// The type of the value that the picker gives follows the value that the parent gives.
<DatePicker.Root
  modelValue={day}
  onValueChange={(value) => {
    expectType<Temporal.PlainDate | null, typeof value>(value);
  }}
/>;
<DatePicker.Root
  defaultValue={dateTime}
  onValueChange={(value) => {
    expectType<Temporal.PlainDateTime | null, typeof value>(value);
  }}
/>;
<DatePicker.Root
  defaultValue={zoned}
  onValueChange={(value) => {
    expectType<Temporal.ZonedDateTime | null, typeof value>(value);
  }}
/>;
<DatePicker.Root
  modelValue={month}
  onValueChange={(value) => {
    expectType<Temporal.PlainYearMonth | null, typeof value>(value);
  }}
/>;
<DatePicker.Root modelValue={null} />;

// @ts-expect-error a plain `Date` is not a value of the picker
<DatePicker.Root modelValue={new Date()} />;
// @ts-expect-error a time has no date
<DatePicker.Root modelValue={Temporal.PlainTime.from('15:04')} />;
// @ts-expect-error `minDate` is a `Temporal` value
<DatePicker.Root minDate={new Date()} />;

function assertValueChange(details: DatePicker.Root.ChangeEventDetails) {
  expectType<
    | 'day-press'
    | 'month-press'
    | 'year-press'
    | 'trigger-press'
    | 'keyboard'
    | 'month-change'
    | 'input-change'
    | 'input-clear'
    | 'input-paste'
    | 'clear-press'
    | 'none',
    DatePicker.Root.ChangeEventDetails['reason']
  >(details.reason);

  if (details.reason === REASONS.dayPress) {
    const event: MouseEvent | KeyboardEvent | PointerEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }
}

void assertValueChange;

// The details of an open change have the reasons of the popover, and a way to keep the popup.
function assertOpenChange(details: DatePicker.Root.OpenChangeEventDetails) {
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
    DatePicker.Root.OpenChangeEventDetails['reason']
  >(details.reason);
}

void assertOpenChange;

// The granularity is a unit of the date or the time.
const granularity: DatePicker.Root.Granularity = 'second';
void granularity;
// @ts-expect-error a picker has no `year` granularity
const invalidGranularity: DatePicker.Root.Granularity = 'year';
void invalidGranularity;

// The actions are those of the popover.
declare const actions: DatePicker.Root.Actions;
expectType<() => void, typeof actions.close>(actions.close);
