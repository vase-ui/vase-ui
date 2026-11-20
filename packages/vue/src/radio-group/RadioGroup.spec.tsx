import { expectType } from '#test-utils';
import { RadioGroup, type RadioGroupProps } from '@vase-ui/vue/radio-group';

const values = ['a', 'b', 'c'];

<RadioGroup
  modelValue={values[0]}
  onValueChange={(value) => {
    expectType<string, typeof value>(value);
  }}
/>;

const narrowedValues = ['a', 'b', 'c'] as const;
type NarrowedValue = (typeof narrowedValues)[number];
const narrowedIndex: number = 0;
const narrowedValue = narrowedValues[narrowedIndex];

<RadioGroup
  modelValue={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup
  defaultValue={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup<NarrowedValue>
  modelValue={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup<string | null>
  onValueChange={(value) => {
    expectType<string | null, typeof value>(value);
  }}
/>;

<RadioGroup
  modelValue={null}
  onValueChange={(value) => {
    expectType<null, typeof value>(value);
  }}
/>;

<RadioGroup
  defaultValue={null}
  onValueChange={(value) => {
    expectType<null, typeof value>(value);
  }}
/>;

// The type parameter of the props reaches the type on the part.
const numberProps = null as unknown as RadioGroup.Props<number>;
expectType<RadioGroupProps<number>, typeof numberProps>(numberProps);
