import { Button, ButtonDataAttributes } from '@vase-ui/vue/button';
import type { ButtonProps, ButtonState } from '@vase-ui/vue/button';
import type { HTMLProps } from '@vase-ui/vue/types';

<Button />;
<Button type="submit" form="form-id" name="action" />;

<Button nativeButton={false} as="span" />;
<Button
  nativeButton={false}
  v-slots={{ render: ({ props }: { props: HTMLProps }) => <div {...props} /> }}
/>;
<Button nativeButton={false} disabled as="span" />;

<Button nativeButton={false} type="submit" />;

export const props: Button.Props = {
  disabled: true,
  focusableWhenDisabled: true,
  nativeButton: false,
} satisfies ButtonProps;
export const state: Button.State = { disabled: true } satisfies ButtonState;
export const attribute: 'data-disabled' = ButtonDataAttributes.disabled;
