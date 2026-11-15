import { expectType } from '#test-utils';
import { TimeField } from '@vase-ui/vue/time-field';
import { REASONS } from '../../internals/reasons';

declare const time: Temporal.PlainTime;
declare const dateTime: Temporal.PlainDateTime;
declare const zoned: Temporal.ZonedDateTime;
declare const date: Temporal.PlainDate;

const timeValue = (
  <TimeField.Root
    value={time}
    onValueChange={(v) => expectType<Temporal.PlainTime | null, typeof v>(v)}
  />
);
const timeDefaultValue = (
  <TimeField.Root
    defaultValue={time}
    onValueChange={(v) => expectType<Temporal.PlainTime | null, typeof v>(v)}
  />
);
const dateTimeValue = (
  <TimeField.Root
    value={dateTime}
    onValueChange={(v) => expectType<Temporal.PlainDateTime | null, typeof v>(v)}
  />
);
const zonedValue = (
  <TimeField.Root
    defaultValue={zoned}
    onValueChange={(v) => expectType<Temporal.ZonedDateTime | null, typeof v>(v)}
    onUpdate:value={(v) => expectType<Temporal.ZonedDateTime | null, typeof v>(v)}
  />
);
const noValue = (
  <TimeField.Root onValueChange={(v) => expectType<Temporal.PlainTime | null, typeof v>(v)} />
);
const explicitKind = (
  <TimeField.Root<Temporal.PlainDateTime>
    onValueChange={(v) => expectType<Temporal.PlainDateTime | null, typeof v>(v)}
  />
);
const referenceDate = <TimeField.Root referenceDate={zoned} />;

// @ts-expect-error a date has no time
const dateValue = <TimeField.Root value={date} />;
// @ts-expect-error a text is not a time
const textValue = <TimeField.Root value="15:04" />;
// @ts-expect-error `granularity` has no `day`
const dayGranularity = <TimeField.Root granularity="day" />;
// @ts-expect-error `hourCycle` is 12 or 24
const hourCycle = <TimeField.Root hourCycle={23} />;
// @ts-expect-error `minTime` is a time
const minTime = <TimeField.Root minTime="09:00" />;

type ChangeDetails = TimeField.Root.ChangeEventDetails;

function assertChange(details: ChangeDetails) {
  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.clearPress) {
    const event: MouseEvent | KeyboardEvent = details.event;
    void event;
    // @ts-expect-error a press has no clipboard event
    const clipboardEvent: ClipboardEvent = details.event;
    void clipboardEvent;
  }
}

type ChangeReason = TimeField.Root.ChangeEventReason;
expectType<
  'input-change' | 'input-clear' | 'input-paste' | 'keyboard' | 'clear-press' | 'none',
  ChangeReason
>('none' as ChangeReason);

declare const actions: TimeField.Root.Actions;
expectType<() => void, typeof actions.clear>(actions.clear);

declare const segment: TimeField.Input.Segment;
if (segment.editable) {
  expectType<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'dayPeriod',
    typeof segment.type
  >(segment.type);
} else {
  expectType<string, typeof segment.text>(segment.text);
}

export {
  timeValue,
  timeDefaultValue,
  dateTimeValue,
  zonedValue,
  noValue,
  explicitKind,
  referenceDate,
  dateValue,
  textValue,
  dayGranularity,
  hourCycle,
  minTime,
  assertChange,
};
