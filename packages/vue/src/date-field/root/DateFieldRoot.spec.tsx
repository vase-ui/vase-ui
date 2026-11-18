import { expectType } from '#test-utils';
import { DateField } from '@vase-ui/vue/date-field';
import { REASONS } from '../../internals/reasons';

declare const day: Temporal.PlainDate;
declare const dateTime: Temporal.PlainDateTime;
declare const zoned: Temporal.ZonedDateTime;
declare const month: Temporal.PlainYearMonth;

// The type of the value that the field gives follows the value that the parent gives.
<DateField.Root
  modelValue={day}
  onValueChange={(value) => {
    expectType<Temporal.PlainDate | null, typeof value>(value);
  }}
/>;
<DateField.Root
  defaultValue={dateTime}
  onValueChange={(value) => {
    expectType<Temporal.PlainDateTime | null, typeof value>(value);
  }}
/>;
<DateField.Root
  defaultValue={zoned}
  onValueChange={(value) => {
    expectType<Temporal.ZonedDateTime | null, typeof value>(value);
  }}
/>;
<DateField.Root
  modelValue={month}
  onValueChange={(value) => {
    expectType<Temporal.PlainYearMonth | null, typeof value>(value);
  }}
/>;
<DateField.Root modelValue={null} />;

// @ts-expect-error a plain `Date` is not a value of the field
<DateField.Root modelValue={new Date()} />;
// @ts-expect-error a time has no date
<DateField.Root modelValue={Temporal.PlainTime.from('15:04')} />;
// @ts-expect-error `minDate` is a `Temporal` value
<DateField.Root minDate={new Date()} />;

type ChangeDetails = DateField.Root.ChangeEventDetails;

function assertChange(details: ChangeDetails) {
  expectType<
    'input-change' | 'input-clear' | 'input-paste' | 'keyboard' | 'clear-press' | 'none',
    ChangeDetails['reason']
  >(details.reason);

  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.clearPress) {
    const event: PointerEvent | MouseEvent | KeyboardEvent = details.event;
    void event;
    // @ts-expect-error a press has no clipboard event
    const clipboardEvent: ClipboardEvent = details.event;
    void clipboardEvent;
  }
}

void assertChange;

// The granularity is a unit of the date or the time.
const granularity: DateField.Root.Granularity = 'second';
void granularity;
// @ts-expect-error a field has no `year` granularity
const invalidGranularity: DateField.Root.Granularity = 'year';
void invalidGranularity;

// The slot `segment` has the layout part and its index. A part that the user edits has no text.
<DateField.Input
  v-slots={{
    segment: ({ segment, index }: { segment: DateField.Input.Segment; index: number }) => {
      expectType<number, typeof index>(index);
      if (segment.editable) {
        // @ts-expect-error an editable segment has no text
        const text: string = segment.text;
        void text;
        return <DateField.Segment segment={segment} />;
      }
      expectType<string, typeof segment.text>(segment.text);
      return <DateField.Literal segment={segment} />;
    },
  }}
/>;
