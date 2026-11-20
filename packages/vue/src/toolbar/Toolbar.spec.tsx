import { expectType } from '#test-utils';
import {
  Toolbar,
  type ToolbarButtonState,
  type ToolbarInputProps,
  type ToolbarOrientation,
  type ToolbarRootProps,
} from '@vase-ui/vue/toolbar';

// The exposed `element` is the element of the part, so a template ref can read it.
const buttonPart = null as unknown as InstanceType<typeof Toolbar.Button>;
expectType<HTMLElement | null, typeof buttonPart.element>(buttonPart.element);

// The namespace types are the flat types.
expectType<ToolbarRootProps, Toolbar.Root.Props>({} as Toolbar.Root.Props);
expectType<ToolbarOrientation, Toolbar.Orientation>('vertical' as Toolbar.Orientation);
expectType<ToolbarButtonState, Toolbar.Button.State>({} as Toolbar.Button.State);

export const link = <Toolbar.Link href="https://vase-ui.com" target="_blank" />;

export const button = <Toolbar.Button type="submit" disabled focusableWhenDisabled={false} />;

export const input = (
  <Toolbar.Input
    modelValue="a"
    autocomplete="off"
    type="search"
    placeholder="Search"
    onValueChange={(value, details) => {
      expectType<string, typeof value>(value);
      details.cancel();
    }}
    onUpdate:modelValue={(value) => expectType<string, typeof value>(value)}
  />
);

export const inputProps: ToolbarInputProps = { defaultValue: 'a', name: 'query', readonly: true };

// @ts-expect-error `orientation` is 'horizontal' or 'vertical'.
export const wrongOrientation = <Toolbar.Root orientation="diagonal" />;
