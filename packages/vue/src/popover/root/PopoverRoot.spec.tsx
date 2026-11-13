import { expectType } from '#test-utils';
import { Toolbar } from '@vase-ui/vue/toolbar';
import * as Popover from '../index.parts';

const numberPayloadHandle = Popover.createHandle<number>();

<Popover.Root handle={numberPayloadHandle}>
  <Popover.Trigger />
</Popover.Root>;

<Popover.Root
  handle={numberPayloadHandle}
  v-slots={{
    default: ({ payload }: { payload: number | undefined }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    },
  }}
/>;

<Popover.Trigger handle={numberPayloadHandle} payload={42} />;
<Popover.Trigger handle={numberPayloadHandle} />;

// @ts-expect-error The handle requires a number payload, not a string.
<Popover.Trigger handle={numberPayloadHandle} payload={'invalid'} />;

<Popover.Trigger as={Toolbar.Button} />;
