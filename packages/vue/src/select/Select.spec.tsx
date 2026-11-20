import { expectType } from '#test-utils';
import { Select, type SelectRootChangeEventDetails } from '@vase-ui/vue/select';

const items = [
  { value: 'a', label: 'apple' },
  { value: 'b', label: 'banana' },
] as const;

// The value takes its type from the default value, and the change can clear it.
<Select.Root
  items={items}
  defaultValue="a"
  itemToStringLabel={(item) => item.toUpperCase()}
  onValueChange={(value, details) => {
    expectType<string | null, typeof value>(value);
    expectType<'item-press' | 'none', typeof details.reason>(details.reason);
    // @ts-expect-error The selection can be cleared, so the value can be `null`.
    value.startsWith('a');
  }}
/>;

// With `multiple`, the value is an array.
<Select.Root
  multiple
  defaultValue={['a']}
  onValueChange={(value) => expectType<string[], typeof value>(value)}
/>;

// An object value with a comparison of its own.
type Font = { code: string };
<Select.Root
  modelValue={{ code: 'mono' } as Font}
  isItemEqualToValue={(item, value) => item.code === value.code}
  onUpdate:modelValue={(value) => expectType<Font | null, typeof value>(value)}
/>;

// The details of the open change have the reasons of the popup layer.
declare const details: Select.Root.OpenChangeEventDetails;
expectType<Select.Root.OpenChangeEventReason, typeof details.reason>(details.reason);
expectType<() => void, typeof details.allowPropagation>(details.allowPropagation);
declare const change: SelectRootChangeEventDetails;
expectType<Select.Root.ChangeEventDetails, typeof change>(change);

// The positioner takes the props of the layer and the alignment with the trigger.
export const positionerProps: Select.Positioner.Props = {
  side: 'inline-end',
  alignItemWithTrigger: false,
  collisionAvoidance: { fallbackAxisSide: 'none' },
};

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof Select.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
