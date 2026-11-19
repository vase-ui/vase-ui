import { Radio } from '@vase-ui/vue/radio';

const value = 'a';

export const inferred = [<Radio value={value} />, <Radio value={1} />, <Radio value={null} />];

export const explicit = <Radio<string | null> value={null} />;

// @ts-expect-error The value must have the type that the generic gives.
export const wrongValue = <Radio<'a' | 'b'> value="c" />;
