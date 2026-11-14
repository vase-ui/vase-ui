import type { AnchorHTMLAttributes } from 'vue';
import { expectType } from '#test-utils';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import * as PreviewCard from '../index.parts';

// `PreviewCard.Trigger` exposes the native `<a>` props in its `#render` slot.
const renderLink: ComponentRenderFn<
  HTMLProps & AnchorHTMLAttributes,
  PreviewCard.Trigger.State
> = ({ props }) => {
  expectType<string | undefined, typeof props.href>(props.href);
  return <a {...props} />;
};

<PreviewCard.Trigger v-slots={{ render: renderLink }} />;

// vue-tsc keeps the slots of a generic component in `__ctx`.
type TriggerSlots = NonNullable<ReturnType<typeof PreviewCard.Trigger>['__ctx']>['slots'];
const renderSlotProps = null as unknown as Parameters<NonNullable<TriggerSlots['render']>>[0];

expectType<
  { props: HTMLProps & AnchorHTMLAttributes; state: PreviewCard.Trigger.State },
  typeof renderSlotProps
>(renderSlotProps);

<PreviewCard.Trigger href="/page" target="_blank" rel="noreferrer" />;
// @ts-expect-error `href` is a string.
<PreviewCard.Trigger href={42} />;
