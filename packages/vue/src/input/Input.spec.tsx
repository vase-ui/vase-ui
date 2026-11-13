import { Input } from '@vase-ui/vue/input';
import { expectType } from '#test-utils';

export const textarea = <Input as="textarea" />;

// The exposed `element` is the element of the part, so a template ref can read it.
const input = null as unknown as InstanceType<typeof Input>;
expectType<HTMLElement | null, typeof input.element>(input.element);

export const withListener = (
  <Input onValueChange={(value: string, details: Input.ChangeEventDetails) => {}} />
);
