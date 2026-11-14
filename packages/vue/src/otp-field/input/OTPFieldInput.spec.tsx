import type { InputHTMLAttributes } from 'vue';
import { expectType } from '#test-utils';
import { OTPField } from '@vase-ui/vue/otp-field';

// @ts-expect-error - slot order is inferred from render order
const noExplicitIndexSupport = <OTPField.Input index={0} />;
void noExplicitIndexSupport;

// `OTPField.Input` exposes the native `<input>` props in its `#render` slot.
type RenderSlot = NonNullable<InstanceType<typeof OTPField.Input>['$slots']['render']>;
type RenderSlotProps = Parameters<RenderSlot>[0]['props'];

<OTPField.Input
  v-slots={{
    render: ({ props }: { props: RenderSlotProps }) => {
      expectType<InputHTMLAttributes['disabled'], typeof props.disabled>(props.disabled);
      expectType<InputHTMLAttributes['readonly'], typeof props.readonly>(props.readonly);
      return <input {...props} />;
    },
  }}
/>;
