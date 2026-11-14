import { expectType } from '#test-utils';
import * as Combobox from '../../combobox/index.parts';
import * as Autocomplete from '../index.parts';

const objectItems = [
  { value: 'a', label: 'apple' },
  { value: 'b', label: 'banana' },
  { value: 'c', label: 'cherry' },
];

const objectItemsReadonly = [
  { value: 'a', label: 'apple' },
  { value: 'b', label: 'banana' },
  { value: 'c', label: 'cherry' },
] as const;

const groupItemsReadonly = [
  {
    value: 'fruits',
    items: [
      { value: 'a', label: 'apple' },
      { value: 'b', label: 'banana' },
      { value: 'c', label: 'cherry' },
    ],
  },
  {
    value: 'vegetables',
    items: [
      { value: 'd', label: 'daikon' },
      { value: 'e', label: 'endive' },
      { value: 'f', label: 'fennel' },
    ],
  },
] as const;

<Autocomplete.Root
  items={objectItems}
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    return item.label;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    // @ts-expect-error - item is the nested item from groups, not the group itself
    return item.items;
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItemsReadonly}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  value="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

// @ts-expect-error value refers to the input value, not the item object
<Autocomplete.Root items={objectItems} value={objectItems[0]} />;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  defaultValue="javascript"
  onValueChange={(value) => {
    // @ts-expect-error Single selection produces a string, not an array.
    value.pop();
  }}
/>;

<Autocomplete.Root
  defaultValue="test"
  onValueChange={(value, eventDetails) => {
    value.length;
    // @ts-expect-error isItemPress is only emitted by multiple-selection Combobox
    eventDetails.isItemPress;
  }}
/>;

function CollectionApp() {
  const collection = Combobox.createItems(objectItems, {
    getValue: (item) => item.value,
    getLabel: (item) => item.label,
  });

  // @ts-expect-error Autocomplete has no item type parameter, so collections are not accepted.
  return <Autocomplete.Root items={collection} />;
}
void CollectionApp;

declare const value: string;

<Autocomplete.Root
  value={value}
  onValueChange={(newValue) => {
    newValue.length;
  }}
/>;

<Autocomplete.Root
  onItemHighlighted={(_item, details) => {
    if (details.reason === 'pointer') {
      expectType<MouseEvent | PointerEvent, typeof details.event>(details.event);
      // @ts-expect-error Hover can report a MouseEvent without pointer-specific methods.
      details.event.getCoalescedEvents();
      if (details.event instanceof PointerEvent) {
        expectType<PointerEvent, typeof details.event>(details.event);
        details.event.getCoalescedEvents();
      }
    } else if (details.reason === 'keyboard') {
      expectType<KeyboardEvent, typeof details.event>(details.event);
    } else {
      expectType<Event, typeof details.event>(details.event);
    }
  }}
/>;

// The item of a list of groups is the item of a group.
<Autocomplete.Root
  items={groupItemsReadonly}
  onItemHighlighted={(item) => {
    expectType<(typeof groupItemsReadonly)[number]['items'][number] | undefined, typeof item>(item);
  }}
  filter={(item, query) => item.label.includes(query)}
/>;

// A root with no `items` gives `unknown`, as Base UI does.
<Autocomplete.Root
  onItemHighlighted={(item) => {
    expectType<unknown, typeof item>(item);
  }}
/>;

// The state types of the parts that Base UI types with fewer keys omit those keys.
declare const triggerState: Autocomplete.Trigger.State;
declare const inputGroupState: Autocomplete.InputGroup.State;
declare const itemState: Autocomplete.Item.State;

expectType<boolean, typeof itemState.highlighted>(itemState.highlighted);
// @ts-expect-error The state of an item of Autocomplete has no `selected`.
itemState.selected;
// @ts-expect-error The state of the trigger of Autocomplete has no `placeholder`.
triggerState.placeholder;
// @ts-expect-error The state of the input group of Autocomplete has no `placeholder`.
inputGroupState.placeholder;
