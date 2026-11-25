import { expectType } from '#test-utils';
import {
  Switch,
  type SwitchChangeEventDetails,
  type SwitchProps,
  type SwitchState,
} from '@vase-ui/vue/switch';

const toggleSwitch = null as unknown as InstanceType<typeof Switch>;
expectType<HTMLInputElement | null, typeof toggleSwitch.element>(toggleSwitch.element);

export const props: SwitchProps = {
  disabled: true,
  focusableWhenDisabled: true,
};
export const undefinedProps: SwitchProps = {
  focusableWhenDisabled: undefined,
};
export const state: SwitchState = {
  checked: false,
  disabled: true,
  readonly: false,
  required: false,
  touched: false,
  dirty: false,
  valid: null,
  filled: false,
};

const namespaceProps = null as unknown as Switch.Props;
const namespaceState = null as unknown as Switch.State;
expectType<SwitchProps, typeof namespaceProps>(namespaceProps);
expectType<SwitchState, typeof namespaceState>(namespaceState);

export const withProps = (
  <Switch
    name="wifi"
    value="yes"
    disabled
    focusableWhenDisabled
    onCheckedChange={(checked, details) => {
      expectType<boolean, typeof checked>(checked);
      expectType<SwitchChangeEventDetails, typeof details>(details);
    }}
  />
);

// @ts-expect-error `focusableWhenDisabled` is a Boolean.
export const withWrongFocusable = <Switch focusableWhenDisabled="yes" />;
