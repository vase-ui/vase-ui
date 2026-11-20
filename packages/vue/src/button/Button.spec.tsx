import { expectType } from '#test-utils';
import { Button, type ButtonProps, type ButtonState } from '@vase-ui/vue/button';

// The exposed `element` is the element of the part, so a template ref can read it.
const button = null as unknown as InstanceType<typeof Button>;
expectType<HTMLElement | null, typeof button.element>(button.element);

export const props: ButtonProps = { disabled: true, focusableWhenDisabled: true };
export const state: ButtonState = { disabled: true };

export const withNativeAttributes = (
  <Button type="submit" form="order" name="action" value="save" />
);

// @ts-expect-error `disabled` is a Boolean.
export const withWrongDisabled = <Button disabled="yes" />;
