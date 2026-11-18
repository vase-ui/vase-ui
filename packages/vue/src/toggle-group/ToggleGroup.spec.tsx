import { expectType } from '#test-utils';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';

const toggleDefaultValueReadonly = (value: NonNullable<ToggleGroup.Props['defaultValue']>) =>
  expectType<readonly string[], typeof value>(value);

const toggleValueReadonly = (value: NonNullable<ToggleGroup.Props['modelValue']>) =>
  expectType<readonly string[], typeof value>(value);

const values = ['a', 'b', 'c'];

// `null` is an empty value.
<ToggleGroup modelValue={null} defaultValue={null} />;

<ToggleGroup
  modelValue={values}
  onValueChange={(value) => {
    expectType<string[], typeof value>(value);
  }}
/>;

const narrowedValues = ['a', 'b', 'c'] as const;
type ReadonlyValue = (typeof narrowedValues)[number];

<ToggleGroup
  modelValue={narrowedValues}
  onValueChange={(value) => {
    expectType<ReadonlyValue[], typeof value>(value);
  }}
/>;
