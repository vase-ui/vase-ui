import { shallowRef } from 'vue';
import { expectType } from '../common/testUtils';
import { useForwardProps, useForwardPropsEmits } from './index';

declare const props: Readonly<{
  open: boolean;
  modal: boolean | undefined;
  id?: string | undefined;
  count: number;
}>;

const forwarded = useForwardProps(props);
expectType<boolean | undefined, typeof forwarded.value.open>(forwarded.value.open);
expectType<boolean | undefined, typeof forwarded.value.modal>(forwarded.value.modal);
expectType<string | undefined, typeof forwarded.value.id>(forwarded.value.id);
expectType<number, typeof forwarded.value.count>(forwarded.value.count);

const fromGetter = useForwardProps(() => props);
expectType<typeof forwarded, typeof fromGetter>(fromGetter);
const fromRef = useForwardProps(shallowRef(props));
expectType<typeof forwarded, typeof fromRef>(fromRef);

const withoutEmits = useForwardPropsEmits(props);
expectType<typeof forwarded, typeof withoutEmits>(withoutEmits);
// @ts-expect-error -- Without emit, the result has no listener.
withoutEmits.value.onOpenChange;

type Intersect<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Result,
) => void
  ? Result
  : never;
type EmitOf<Events extends Record<string, unknown[]>> = Intersect<
  { [Key in keyof Events]: (event: Key, ...args: Events[Key]) => void }[keyof Events]
>;

declare const emit: EmitOf<{
  openChange: [open: boolean, details: { reason: string }];
  'update:open': [open: boolean];
  optional: [value: string, count?: number];
  rest: [...values: boolean[]];
  empty: [value: void];
}>;
const withEmits = useForwardPropsEmits(props, emit);
expectType<typeof forwarded, typeof withEmits>(withEmits);
// @ts-expect-error -- Listener keys exist at run time but are absent from the return type.
withEmits.value.onOpenChange;
// @ts-expect-error -- Listener keys exist at run time but are absent from the return type.
withEmits.value['onUpdate:open'];

type TwentyEvents = { [Key in `e${0 | 1 | 2 | 3}${0 | 1 | 2 | 3 | 4}`]: [value: Key] };
declare const twentyEvents: EmitOf<TwentyEvents>;
const withTwentyEvents = useForwardPropsEmits(props, twentyEvents);
expectType<typeof forwarded, typeof withTwentyEvents>(withTwentyEvents);

declare const namesOnly: (event: 'a' | 'b', ...args: any[]) => void;
const withNamesOnly = useForwardPropsEmits(props, namesOnly);
expectType<typeof forwarded, typeof withNamesOnly>(withNamesOnly);
