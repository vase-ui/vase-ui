import { NumberField } from '@vase-ui/vue/number-field';
import { expectType } from '#test-utils';
import { REASONS } from '../../internals/reasons';

type NumberFieldChangeDetails = NumberField.Root.ChangeEventDetails;
type NumberFieldWheelEvent = Extract<
  NumberFieldChangeDetails,
  { reason: typeof REASONS.wheel }
>['event'];

expectType<WheelEvent, NumberFieldWheelEvent>(null as unknown as NumberFieldWheelEvent);

function assertNumberFieldChange(details: NumberFieldChangeDetails) {
  if (details.reason === REASONS.wheel) {
    const wheelEvent: WheelEvent = details.event;
    void wheelEvent;
    // @ts-expect-error wheel details should not expose pointer events
    const pointerEvent: PointerEvent = details.event;
    void pointerEvent;
  }

  if (details.reason === REASONS.incrementPress) {
    const event: PointerEvent | MouseEvent | TouchEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputClear) {
    const event: InputEvent | FocusEvent | Event = details.event;
    void event;
    // @ts-expect-error keyboard events are not emitted for input-clear
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }
}

type NumberFieldCommitDetails = NumberField.Root.CommitEventDetails;

function assertNumberFieldCommit(details: NumberFieldCommitDetails) {
  if (details.reason === REASONS.wheel) {
    const event: WheelEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.scrub) {
    const event: PointerEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputClear) {
    const event: InputEvent | FocusEvent | Event = details.event;
    void event;
  }
}

const handleNumberFieldChange = (value: number | null, details: NumberFieldChangeDetails) => {
  expectType<number | null, typeof value>(value);
  assertNumberFieldChange(details);
};

const handleNumberFieldCommit = (value: number | null, details: NumberFieldCommitDetails) => {
  expectType<number | null, typeof value>(value);
  assertNumberFieldCommit(details);
};

const numberFieldEventNarrowing = (
  <NumberField.Root
    defaultValue={0}
    onValueChange={handleNumberFieldChange}
    onValueCommitted={handleNumberFieldCommit}
  />
);
