import { expectType } from '#test-utils';
import * as Dialog from '../index.parts';

const numberPayloadHandle = Dialog.createHandle<number>();

<Dialog.Root handle={numberPayloadHandle}>
  <Dialog.Portal />
</Dialog.Root>;

// TypeScript cannot infer the parameter of a `v-slots` function. vue-tsc keeps the slots of a
// generic component in `__ctx`, so the case reads the default slot of a root with a number payload.
type RootSlots = NonNullable<ReturnType<typeof Dialog.Root<number>>['__ctx']>['slots'];
const rootWithFunctionChildren = null as unknown as Parameters<RootSlots['default']>[0];
expectType<number | undefined, typeof rootWithFunctionChildren.payload>(
  rootWithFunctionChildren.payload,
);

<Dialog.Trigger handle={numberPayloadHandle} payload={42} />;
<Dialog.Trigger handle={numberPayloadHandle} />;
// @ts-expect-error The handle requires a number payload, not a string.
<Dialog.Trigger handle={numberPayloadHandle} payload={'invalid'} />;
