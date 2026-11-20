import { expectType } from '#test-utils';
import type { Toggle, ToggleProps } from '@vase-ui/vue/toggle';
import {
  ToggleGroup,
  type ToggleGroupChangeEventDetails,
  type ToggleGroupProps,
} from '@vase-ui/vue/toggle-group';

const toggleDefaultValueReadonly = (value: NonNullable<ToggleGroupProps['defaultValue']>) =>
  expectType<readonly string[], typeof value>(value);

const toggleValueReadonly = (value: NonNullable<ToggleGroupProps['modelValue']>) =>
  expectType<readonly string[], typeof value>(value);

const values = ['a', 'b', 'c'];

// `null` is an empty value.
<ToggleGroup modelValue={null} defaultValue={null} />;

<ToggleGroup
  modelValue={values}
  onValueChange={(value, details) => {
    expectType<string[], typeof value>(value);
    expectType<ToggleGroupChangeEventDetails, typeof details>(details);
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

// The type parameter of the props reaches the types on the parts.
const groupProps = null as unknown as ToggleGroup.Props<ReadonlyValue>;
expectType<ToggleGroupProps<ReadonlyValue>, typeof groupProps>(groupProps);
const toggleProps = null as unknown as Toggle.Props<ReadonlyValue>;
expectType<ToggleProps<ReadonlyValue>, typeof toggleProps>(toggleProps);

// The exposed `element` is the element of the part, so a template ref can read it.
const toggle = null as unknown as InstanceType<typeof Toggle>;
expectType<HTMLElement | null, typeof toggle.element>(toggle.element);
