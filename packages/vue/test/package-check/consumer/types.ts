import type * as vaseUi from '@vase-ui/vue';
import type { MultiPart } from '@vase-ui/vue/multi-part';
import type { MultiPartRootProps } from '@vase-ui/vue/multi-part';
import type { SinglePart } from '@vase-ui/vue/single-part';
import type { SinglePartProps } from '@vase-ui/vue/single-part';
import type { ChangeEventDetails, ElementSlotProps, GenericEventDetails } from '@vase-ui/vue/types';

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
export const absentItemProps: PropsOf<typeof MultiPart.Item> = {
  value: undefined,
  onSelect: undefined,
};

// The types of the change details and of the `element` slot reach a consumer.
export const keyDetails: GenericEventDetails<'keyboard', KeyboardEvent> = {} as ChangeEventDetails<
  'keyboard',
  KeyboardEvent
>;
export const elementScope: ElementSlotProps<{ open: boolean }> = {
  props: {},
  elementRef: () => undefined,
  state: { open: true },
};

export type Checks = [
  Expect<Equal<typeof vaseUi.SinglePart, typeof SinglePart>>,
  Expect<Equal<typeof vaseUi.MultiPart, typeof MultiPart>>,
  Expect<Equal<typeof keyDetails.event, KeyboardEvent>>,
];
