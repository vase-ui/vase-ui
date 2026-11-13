import { Accordion } from '@vase-ui/vue/accordion';
import { expectType } from '#test-utils';

const stringValues = ['a'];
const nullableValues: (string | null)[] = ['a', null];

export const inferredFromValue = (
  <Accordion.Root
    value={stringValues}
    onValueChange={(value) => {
      expectType<string[], typeof value>(value);
    }}
  />
);

export const inferredFromDefaultValue = (
  <Accordion.Root
    defaultValue={[1]}
    onValueChange={(value) => {
      expectType<number[], typeof value>(value);
    }}
  />
);

export const explicitValue = <Accordion.Root<'a' | 'b'> value={['a']} />;

export const explicitHandler = (
  <Accordion.Root<'a' | 'b'>
    onValueChange={(value) => {
      expectType<('a' | 'b')[], typeof value>(value);
    }}
  />
);

export const nullableValue = (
  <Accordion.Root<string | null>
    value={nullableValues}
    onValueChange={(value) => {
      expectType<(string | null)[], typeof value>(value);
    }}
  />
);

export const defaultGeneric = (
  <Accordion.Root
    onValueChange={(value) => {
      // Backward-compatible default: no explicit generic keeps permissive `any[]`.
      expectType<any[], typeof value>(value);
    }}
  />
);

// @ts-expect-error value must match explicit generic type
export const wrongValue = <Accordion.Root<'a' | 'b'> value={['c']} />;

// `valueChange` is an emit, so the props type has no handler key. The handler types take the value
// type from the props type.
type AccordionChangeHandler = (
  value: NonNullable<Accordion.Root.Props<'a'>['value']>,
  eventDetails: Accordion.Root.ChangeEventDetails,
) => void;
type AccordionDefaultChangeHandler = (
  value: NonNullable<Accordion.Root.Props['value']>,
  eventDetails: Accordion.Root.ChangeEventDetails,
) => void;

const handleValueChange: AccordionChangeHandler = (value) => {
  expectType<'a'[], typeof value>(value);
};

export const typedHandler = <Accordion.Root<'a'> onValueChange={handleValueChange} />;

const handleDefaultValueChange: AccordionDefaultChangeHandler = (value) => {
  expectType<any[], typeof value>(value);
};

export const defaultHandler = <Accordion.Root onValueChange={handleDefaultValueChange} />;

export function Wrapper<Value>(props: Accordion.Root.Props<Value>) {
  return <Accordion.Root {...props} />;
}

export const model = <Accordion.Root<'a' | 'b'> v-model:value={['a']} multiple />;

// @ts-expect-error `Accordion.Item` emits `openChange` and has no prop `open`
export const itemHasNoOpenProp = <Accordion.Item open />;
