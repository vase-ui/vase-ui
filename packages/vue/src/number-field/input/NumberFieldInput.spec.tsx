import type { InputHTMLAttributes } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import { expectType } from '#test-utils';

type RenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof NumberField.Input>['$slots']['render']>
>[0];

// `NumberField.Input` exposes the native `<input>` props in its `#render` slot.
<NumberField.Input
  v-slots={{
    render: ({ props }: RenderSlotProps) => {
      expectType<InputHTMLAttributes['disabled'], typeof props.disabled>(props.disabled);
      expectType<InputHTMLAttributes['readonly'], typeof props.readonly>(props.readonly);
      return <input {...props} />;
    },
  }}
/>;

// The exposed `element` is the element of the part, so a template ref can read it.
const input = null as unknown as InstanceType<typeof NumberField.Input>;
expectType<HTMLElement | null, typeof input.element>(input.element);
