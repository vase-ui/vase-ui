import { expectType } from '#test-utils';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { REASONS } from '../../internals/reasons';

declare const time: Temporal.PlainTime;
declare const dateTime: Temporal.PlainDateTime;
declare const zoned: Temporal.ZonedDateTime;

// The type of the value that the picker gives follows the value that the parent gives.
<TimePicker.Root
  modelValue={time}
  onValueChange={(value) => {
    expectType<Temporal.PlainTime | null, typeof value>(value);
  }}
/>;
<TimePicker.Root
  defaultValue={dateTime}
  onValueChange={(value) => {
    expectType<Temporal.PlainDateTime | null, typeof value>(value);
  }}
/>;
<TimePicker.Root
  defaultValue={zoned}
  onValueChange={(value) => {
    expectType<Temporal.ZonedDateTime | null, typeof value>(value);
  }}
/>;
<TimePicker.Root modelValue={null} />;

// @ts-expect-error a plain `Date` is not a value of the picker
<TimePicker.Root modelValue={new Date()} />;
// @ts-expect-error a date has no time
<TimePicker.Root modelValue={Temporal.PlainDate.from('2026-11-14')} />;
// @ts-expect-error `minTime` is a `Temporal.PlainTime`
<TimePicker.Root minTime="09:00" />;

// The clock gives its reasons for a change of the time, and not the reason of a press on its view
// trigger, which changes the view.
function assertValueChange(details: TimePicker.Root.ChangeEventDetails) {
  expectType<
    | 'drag'
    | 'keyboard'
    | 'input-change'
    | 'item-press'
    | 'input-clear'
    | 'input-paste'
    | 'clear-press'
    | 'none',
    TimePicker.Root.ChangeEventDetails['reason']
  >(details.reason);

  if (details.reason === REASONS.itemPress) {
    const event: MouseEvent | KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }
}

void assertValueChange;

// The details of an open change have the reasons of the popover, and a way to keep the popup.
function assertOpenChange(details: TimePicker.Root.OpenChangeEventDetails) {
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
    TimePicker.Root.OpenChangeEventDetails['reason']
  >(details.reason);
}

void assertOpenChange;

// The granularity is a unit of the time.
const granularity: TimePicker.Root.Granularity = 'second';
void granularity;
// @ts-expect-error a picker has no `day` granularity
const invalidGranularity: TimePicker.Root.Granularity = 'day';
void invalidGranularity;

// A column sets one unit, and a value of a column is a number or a day period.
const unit: TimePicker.Column.Unit = 'dayPeriod';
void unit;
// @ts-expect-error a column has no `year` unit
const invalidUnit: TimePicker.Column.Unit = 'year';
void invalidUnit;
const value: TimePicker.Column.Value = 'am';
void value;

// The actions are those of the popover.
declare const actions: TimePicker.Root.Actions;
expectType<() => void, typeof actions.close>(actions.close);
