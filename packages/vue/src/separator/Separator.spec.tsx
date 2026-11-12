import { Separator, SeparatorDataAttributes } from '@vase-ui/vue/separator';
import type { SeparatorProps, SeparatorState } from '@vase-ui/vue/separator';

export const nativeAttributes = (
  <Separator aria-label="x" lang="fr" onClick={(event) => event.preventVaseUIHandler()} />
);

export const props: Separator.Props = { orientation: 'vertical' } satisfies SeparatorProps;
export const state: Separator.State = { orientation: 'vertical' } satisfies SeparatorState;
export const attribute: 'data-orientation' = SeparatorDataAttributes.orientation;

// @ts-expect-error `orientation` is 'horizontal' or 'vertical'
export const wrongOrientation = <Separator orientation="diagonal" />;
