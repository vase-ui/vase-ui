import { expectType } from '#test-utils';
import { Input, type InputChangeEventDetails } from '@vase-ui/vue/input';

// The exposed `element` is the element of the part, so a template ref can read it.
const input = null as unknown as InstanceType<typeof Input>;
expectType<HTMLInputElement | HTMLTextAreaElement | null, typeof input.element>(input.element);

export const withListener = (
  <Input onValueChange={(value: string, details: InputChangeEventDetails) => details.cancel()} />
);

export const withReason = (
  <Input
    onValueChange={(_value, details) => {
      expectType<'none', typeof details.reason>(details.reason);
    }}
  />
);

// @ts-expect-error The value of `valueChange` is a string.
export const withWrongListener = <Input onValueChange={(value: number) => value} />;
