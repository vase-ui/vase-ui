import { expectType } from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

const stringValue = 'item-1';
const nullableValue: string | null = 'item-1';

export const inferredFromValue = (
  <NavigationMenu.Root
    value={stringValue}
    onValueChange={(value) => {
      expectType<string | null, typeof value>(value);
    }}
  />
);

export const inferredFromDefaultValue = (
  <NavigationMenu.Root
    defaultValue={1}
    onValueChange={(value) => {
      expectType<number | null, typeof value>(value);
    }}
  />
);

export const explicitValue = <NavigationMenu.Root<'a' | 'b'> value="a" />;

export const explicitHandler = (
  <NavigationMenu.Root<'a' | 'b'>
    onValueChange={(value) => {
      expectType<'a' | 'b' | null, typeof value>(value);
    }}
  />
);

export const nullableValueRoot = (
  <NavigationMenu.Root<string | null>
    value={nullableValue}
    onValueChange={(value) => {
      expectType<string | null, typeof value>(value);
    }}
  />
);

export const defaultGeneric = (
  <NavigationMenu.Root
    onValueChange={(value) => {
      // Backward-compatible default: no explicit generic keeps permissive `any`.
      expectType<any, typeof value>(value);
    }}
  />
);

// @ts-expect-error value must match explicit generic type
export const wrongValue = <NavigationMenu.Root<'a' | 'b'> value="c" />;

// `valueChange` is an emit, so the props type has no handler key. The handler types take the value
// type from `NavigationMenu.Root.Value`.
type NavigationMenuChangeHandler = (
  value: NavigationMenu.Root.Value<'a'>,
  eventDetails: NavigationMenu.Root.ChangeEventDetails,
) => void;
type NavigationMenuDefaultChangeHandler = (
  value: NavigationMenu.Root.Value,
  eventDetails: NavigationMenu.Root.ChangeEventDetails,
) => void;

const handleValueChange: NavigationMenuChangeHandler = (value) => {
  expectType<'a' | null, typeof value>(value);
};

export const typedHandler = <NavigationMenu.Root<'a'> onValueChange={handleValueChange} />;

const handleDefaultValueChange: NavigationMenuDefaultChangeHandler = (value) => {
  expectType<any, typeof value>(value);
};

export const defaultHandler = <NavigationMenu.Root onValueChange={handleDefaultValueChange} />;

export function Wrapper<Value>(props: NavigationMenu.Root.Props<Value>) {
  return <NavigationMenu.Root {...props} />;
}
