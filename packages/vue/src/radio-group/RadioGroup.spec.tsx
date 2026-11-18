import { expectType } from '#test-utils';
import { RadioGroup } from '@vase-ui/vue/radio-group';

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
