import { Field } from '@vase-ui/vue/field';
import { expectType } from '#test-utils';

export const textarea = <Field.Control as="textarea" />;

// The exposed `element` is the element of the part, so a template ref can read it.
const control = null as unknown as InstanceType<typeof Field.Control>;
expectType<HTMLElement | null, typeof control.element>(control.element);
