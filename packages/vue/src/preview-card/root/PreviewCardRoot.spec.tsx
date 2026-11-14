import { expectType } from '#test-utils';
import * as PreviewCard from '../index.parts';

const numberPayloadHandle = PreviewCard.createHandle<number>();

<PreviewCard.Root handle={numberPayloadHandle}>
  <PreviewCard.Portal />
</PreviewCard.Root>;

// TypeScript cannot infer the parameter of a `v-slots` function. vue-tsc keeps the slots of a
// generic component in `__ctx`, so the case reads the default slot of a root with a number payload.
type RootSlots = NonNullable<ReturnType<typeof PreviewCard.Root<number>>['__ctx']>['slots'];
const rootWithFunctionChildren = null as unknown as Parameters<RootSlots['default']>[0];
expectType<number | undefined, typeof rootWithFunctionChildren.payload>(
  rootWithFunctionChildren.payload,
);

<PreviewCard.Trigger handle={numberPayloadHandle} payload={42} />;
<PreviewCard.Trigger handle={numberPayloadHandle} />;
// @ts-expect-error The handle requires a number payload, not a string.
<PreviewCard.Trigger handle={numberPayloadHandle} payload={'invalid'} />;
