import { expectType } from '#test-utils';
import {
  NumberField,
  type NumberFieldRootChangeEventDetails,
  type NumberFieldRootCommitEventDetails,
  type NumberFieldRootProps,
  type NumberFieldRootState,
} from '@vase-ui/vue/number-field';

// The types on the parts are the flat types.
expectType<NumberFieldRootProps, NumberField.Root.Props>(null as unknown as NumberField.Root.Props);
expectType<NumberFieldRootState, NumberField.Input.State>(
  null as unknown as NumberField.Input.State,
);
expectType<NumberFieldRootChangeEventDetails, NumberField.Root.ChangeEventDetails>(
  null as unknown as NumberField.Root.ChangeEventDetails,
);

function narrowChange(details: NumberField.Root.ChangeEventDetails) {
  if (details.reason === 'wheel') {
    expectType<WheelEvent, typeof details.event>(details.event);
    // @ts-expect-error A wheel gives no pointer event.
    const pointerEvent: PointerEvent = details.event;
    void pointerEvent;
  }
  if (details.reason === 'increment-press') {
    expectType<PointerEvent | MouseEvent, typeof details.event>(details.event);
  }
  if (details.reason === 'input-blur') {
    expectType<FocusEvent, typeof details.event>(details.event);
  }
  if (details.reason === 'keyboard') {
    expectType<1 | -1 | undefined, typeof details.direction>(details.direction);
  }
}

function narrowCommit(details: NumberFieldRootCommitEventDetails) {
  if (details.reason === 'scrub') {
    expectType<PointerEvent, typeof details.event>(details.event);
  }
  if (details.reason === 'input-clear') {
    expectType<FocusEvent, typeof details.event>(details.event);
  }
  // @ts-expect-error A commit has no reason `input-change`.
  if (details.reason === 'input-change') void details;
}

export const withListeners = (
  <NumberField.Root
    defaultValue={0}
    onValueChange={(value, details) => {
      expectType<number | null, typeof value>(value);
      narrowChange(details);
    }}
    onValueCommitted={(value, details) => {
      expectType<number | null, typeof value>(value);
      narrowCommit(details);
    }}
  />
);

// @ts-expect-error `step` is a number or `'any'`.
export const wrongStep = <NumberField.Root step="2" />;

const onClick = (event: MouseEvent) => event.preventDefault();

// Each part takes the native attributes of its element.
export const withAttributes = (
  <NumberField.Root lang="fr" onClick={onClick}>
    <NumberField.ScrubArea lang="fr" onClick={onClick} />
    <NumberField.Group lang="fr" onClick={onClick}>
      <NumberField.Decrement lang="fr" onClick={onClick} />
      <NumberField.Input lang="fr" placeholder="0" onClick={onClick} />
      <NumberField.Increment lang="fr" onClick={onClick} />
    </NumberField.Group>
  </NumberField.Root>
);

// The exposed `element` is the element of the part, so a template ref can read it.
const root = null as unknown as InstanceType<typeof NumberField.Root>;
expectType<HTMLElement | null, typeof root.element>(root.element);
expectType<HTMLInputElement | null, typeof root.inputElement>(root.inputElement);
const input = null as unknown as InstanceType<typeof NumberField.Input>;
expectType<HTMLInputElement | null, typeof input.element>(input.element);
