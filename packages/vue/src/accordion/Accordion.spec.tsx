import { Accordion } from '@vase-ui/vue/accordion';
import type {
  AccordionHeaderProps,
  AccordionItemChangeEventDetails,
  AccordionItemProps,
  AccordionItemState,
  AccordionPanelProps,
  AccordionRootChangeEventDetails,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionValue,
} from '@vase-ui/vue/accordion';
import { expectType } from '#test-utils';

// The namespace types are the flat types.
expectType<AccordionRootProps<'a'>, Accordion.Root.Props<'a'>>({} as Accordion.Root.Props<'a'>);
expectType<AccordionRootState<'a'>, Accordion.Root.State<'a'>>({} as Accordion.Root.State<'a'>);
expectType<AccordionValue<'a'>, Accordion.Root.Value<'a'>>([]);
expectType<AccordionRootChangeEventDetails, Accordion.Root.ChangeEventDetails>(
  {} as Accordion.Root.ChangeEventDetails,
);
expectType<AccordionItemProps, Accordion.Item.Props>({} as Accordion.Item.Props);
expectType<AccordionItemState, Accordion.Item.State>({} as Accordion.Item.State);
expectType<AccordionItemChangeEventDetails, Accordion.Item.ChangeEventDetails>(
  {} as Accordion.Item.ChangeEventDetails,
);
expectType<AccordionHeaderProps, Accordion.Header.Props>({} as Accordion.Header.Props);
expectType<AccordionTriggerProps, Accordion.Trigger.Props>({} as Accordion.Trigger.Props);
expectType<AccordionTriggerState, Accordion.Trigger.State>({} as Accordion.Trigger.State);
expectType<AccordionPanelProps, Accordion.Panel.Props>({} as Accordion.Panel.Props);

const stringValues = ['a'];

// `Value` comes from `modelValue`, from `defaultValue`, or from the type argument.
export const inferredFromValue = (
  <Accordion.Root
    modelValue={stringValues}
    onValueChange={(value) => {
      expectType<string[], typeof value>(value);
    }}
  />
);

export const inferredFromDefaultValue = (
  <Accordion.Root
    defaultValue={[1]}
    onValueChange={(value) => {
      expectType<number[], typeof value>(value);
    }}
  />
);

export const explicitValue = (
  <Accordion.Root<'a' | 'b'>
    modelValue={['a']}
    onValueChange={(value) => {
      expectType<('a' | 'b')[], typeof value>(value);
    }}
  />
);

export const defaultValue = (
  <Accordion.Root
    onValueChange={(value) => {
      expectType<any[], typeof value>(value);
    }}
  />
);

// `null` is an empty value.
export const nullValue = <Accordion.Root modelValue={null} defaultValue={null} />;

// @ts-expect-error The value must match the type argument.
export const wrongValue = <Accordion.Root<'a' | 'b'> modelValue={['c']} />;

const onClick = (event: MouseEvent) => event.preventDefault();

// Each part takes the native attributes and listeners of its element, and `as`.
export const tree = (
  <Accordion.Root as="section" v-model={['a']} multiple keepMounted hiddenUntilFound disabled>
    <Accordion.Item as="article" value="a" disabled onOpenChange={() => {}}>
      <Accordion.Header as="h2" lang="fr">
        <Accordion.Trigger as="span" id="trigger" onClick={onClick} disabled />
      </Accordion.Header>
      <Accordion.Panel as="aside" id="panel" keepMounted={false} hiddenUntilFound lang="fr" />
    </Accordion.Item>
  </Accordion.Root>
);

// @ts-expect-error `Accordion.Item` emits `openChange` and has no prop `open`.
export const itemHasNoOpenProp = <Accordion.Item open />;

type TriggerSlots = InstanceType<typeof Accordion.Trigger>['$slots'];
const elementSlotProps = null as unknown as Parameters<NonNullable<TriggerSlots['element']>>[0];

expectType<
  {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AccordionTriggerState;
  },
  typeof elementSlotProps
>(elementSlotProps);
