import type * as vaseUi from '@vase-ui/vue';
import type { MultiPart, MultiPartItem, MultiPartRoot } from '@vase-ui/vue/multi-part';
import type { MultiPartRootProps } from '@vase-ui/vue/multi-part';
import type { SinglePart, SinglePartDataAttributes } from '@vase-ui/vue/single-part';
import type { SinglePartProps } from '@vase-ui/vue/single-part';

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Expect<Condition extends true> = Condition;
type PropsOf<Part extends abstract new (...args: never) => { $props: unknown }> =
  InstanceType<Part>['$props'];

export const singlePartProps: SinglePart.Props = { orientation: 'vertical' };
// @ts-expect-error `orientation` takes only 'horizontal' or 'vertical'.
export const singlePartWrongProps: SinglePart.Props = { orientation: 'diagonal' };

export const multiPartRootProps: MultiPart.Root.Props<number> = { payload: 1 };
// @ts-expect-error `payload` must be a number.
export const multiPartRootWrongProps: MultiPart.Root.Props<number> = { payload: 'one' };

export const flatSinglePartProps: SinglePartProps = singlePartProps;
export const flatMultiPartRootProps: MultiPartRootProps<number> = multiPartRootProps;

// This project sets `exactOptionalPropertyTypes`. An optional prop and a listener accept `undefined`.
export const absentItemProps: PropsOf<typeof MultiPartItem> = {
  value: undefined,
  onSelect: undefined,
};

export type Checks = [
  Expect<Equal<typeof SinglePartDataAttributes.orientation, 'data-orientation'>>,
  Expect<Equal<typeof MultiPart.Root, typeof MultiPartRoot>>,
  Expect<Equal<typeof vaseUi.SinglePart, typeof SinglePart>>,
  Expect<Equal<typeof vaseUi.MultiPart, typeof MultiPart>>,
];
