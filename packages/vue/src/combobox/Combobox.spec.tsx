import { Autocomplete } from '@vase-ui/vue/autocomplete';
import {
  Combobox,
  type ComboboxItemCollection,
  type ComboboxRootChangeEventDetails,
  type ComboboxRootChangeEventReason,
  type ComboboxRootHighlightEventDetails,
  type ComboboxRootOpenChangeEventDetails,
} from '@vase-ui/vue/combobox';
import { expectType } from '#test-utils';

interface Fruit {
  value: string;
  label: string;
}

const fruits: Fruit[] = [{ value: 'a', label: 'Apple' }];

// The value comes from `modelValue` or `defaultValue`. A single value can be `null`, and a multiple
// value is a list.
<Combobox.Root
  items={fruits}
  defaultValue={fruits[0]}
  onValueChange={(value) => expectType<Fruit | null, typeof value>(value)}
/>;
<Combobox.Root
  items={fruits}
  multiple
  defaultValue={fruits}
  onValueChange={(value) => expectType<Fruit[], typeof value>(value)}
/>;

// A collection carries its source items and their derived values.
const users = Combobox.createItems([{ id: 1, name: 'Ann' }], {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});
expectType<ComboboxItemCollection<{ id: number; name: string }, number>, typeof users>(users);

// The details of a change of the value or the text, of the open state, and of the highlight.
declare const details: ComboboxRootChangeEventDetails;
expectType<ComboboxRootChangeEventReason, typeof details.reason>(details.reason);
expectType<boolean | undefined, typeof details.isItemPress>(details.isItemPress);
expectType<() => void, typeof details.allowPropagation>(details.allowPropagation);
expectType<Combobox.Root.ChangeEventDetails, typeof details>(details);
declare const openDetails: ComboboxRootOpenChangeEventDetails;
expectType<Element | undefined, typeof openDetails.trigger>(openDetails.trigger);
declare const highlight: ComboboxRootHighlightEventDetails;
expectType<number, typeof highlight.index>(highlight.index);
expectType<Event | undefined, typeof highlight.event>(highlight.event);

// The text of Autocomplete is its value.
<Autocomplete.Root onValueChange={(value) => expectType<string, typeof value>(value)} />;

// The state of an item of Autocomplete has no `selected`.
declare const itemState: Autocomplete.Item.State;
// @ts-expect-error An item of Autocomplete selects no value.
void itemState.selected;

// A template ref of the root has `close()`, its element and its hidden text input.
const root = null as unknown as InstanceType<typeof Combobox.Root>;
expectType<() => void, typeof root.close>(root.close);
expectType<HTMLInputElement | null, typeof root.inputElement>(root.inputElement);
