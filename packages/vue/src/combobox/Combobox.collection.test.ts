import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { computed, nextTick, reactive, shallowRef } from 'vue';
import { Combobox, type ComboboxRootHighlightEventDetails } from '@vase-ui/vue/combobox';
import ComboboxCollection from '../../test/fixtures/ComboboxCollection.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

interface User {
  id: number;
  name: string;
  team?: string;
}

const USERS: User[] = [
  { id: 1, name: 'Ann', team: 'red' },
  { id: 2, name: 'Bob', team: 'blue' },
  { id: 3, name: 'Cal', team: 'red' },
];

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (id: number) => byTestId(`item-${id}`)!;
const itemNames = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;
const named = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map(
    (each) => each.value,
  );

const users = (data: readonly User[] | undefined, getLabel = (user: User) => user.name) =>
  Combobox.createItems(data as User[] | undefined, { getValue: (user) => user.id, getLabel });

async function mountCollection(props: Props) {
  const result = mount(ComboboxCollection, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('a pick of a collection', () => {
  test('gives the derived value with the keys and with the pointer, also with `multiple`; the form data has the derived values', async () => {
    const values: unknown[] = [];
    const first = await mountCollection({
      items: users(USERS),
      root: { name: 'user', 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await closed();
    expect(values).toEqual([2]);
    expect(input().value).toBe('Bob');
    expect(named('user')).toEqual(['2']);
    first.unmount();
    values.length = 0;
    await mountCollection({
      items: users(USERS),
      root: {
        name: 'users',
        multiple: true,
        itemToStringValue: (value: number) => `user-${value}`,
        'onUpdate:modelValue': (value: unknown) => values.push(value),
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item(1));
    await userEvent.click(item(3));
    await userEvent.click(item(1));
    expect(values).toEqual([[1], [1, 3], [3]]);
    expect(named('users')).toEqual(['user-3']);
  });

  test('the selected derived value has the highlight at the open', async () => {
    await mountCollection({ items: users(USERS), root: { defaultValue: 2 } });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Bob'));
  });

  test('a highlight event of a virtualized list gives the derived value', async () => {
    const log: unknown[] = [];
    await mountCollection({
      items: users(USERS),
      root: {
        virtualized: true,
        onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
          log.push([value, details.index]),
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(log.at(-1)).toEqual([2, 1]);
  });

  test.each([
    { value: 0, name: 'Zero' },
    { value: '', name: 'Empty' },
    { value: false, name: 'False' },
    { value: 10n, name: 'Bigint' },
  ])('resolves the primitive $name as a selection', async ({ value, name }) => {
    const data = [{ id: value, name }];
    await mountCollection({
      inputInPopup: true,
      items: Combobox.createItems(data, {
        getValue: (each) => each.id,
        getLabel: (each) => each.name,
      }),
      root: { defaultValue: value },
    });
    expect(trigger()).toHaveTextContent(name);
  });
});

describe('the label of a derived value', () => {
  test('a value out of the data takes `itemToStringLabel`, else its text, and no value shows no "null"', async () => {
    const first = await mountCollection({
      inputInPopup: true,
      items: users(USERS),
      root: { defaultValue: 9, itemToStringLabel: (value: number) => `User ${value}` },
    });
    expect(trigger()).toHaveTextContent('User 9');
    first.unmount();
    const second = await mountCollection({
      inputInPopup: true,
      items: users([]),
      root: { defaultValue: 9 },
    });
    expect(trigger()).toHaveTextContent('9');
    second.unmount();
    await mountCollection({ inputInPopup: true, items: users(USERS) });
    expect(trigger()).toHaveTextContent('None');
    expect(trigger().textContent).not.toContain('null');
  });

  test('follows data that loads, shrinks, and an accessor with a new result', async () => {
    const data = shallowRef<User[] | undefined>(undefined);
    const suffix = shallowRef('');
    const items = computed(() => users(data.value, (user) => `${user.name}${suffix.value}`));
    // The props of the root are reactive, so the collection there follows the computed.
    await mountCollection({
      inputInPopup: true,
      items: items.value,
      root: reactive<Props>({ items, defaultValue: 2 }),
    });
    expect(trigger()).toHaveTextContent('2');
    data.value = USERS;
    await nextTick();
    expect(trigger()).toHaveTextContent('Bob');
    suffix.value = '!';
    await nextTick();
    expect(trigger()).toHaveTextContent('Bob!');
    data.value = [USERS[0]!];
    await nextTick();
    expect(trigger()).toHaveTextContent('2');
  });

  test('a custom comparer finds the value in the data', async () => {
    await mountCollection({
      inputInPopup: true,
      items: users(USERS),
      root: {
        defaultValue: 2.4,
        isItemEqualToValue: (a: number, b: number) => Math.round(a) === Math.round(b),
      },
    });
    expect(trigger()).toHaveTextContent('Bob');
  });

  test('an empty list shows while the data is undefined, and the items show once it loads', async () => {
    const data = shallowRef<User[] | undefined>(undefined);
    const items = computed(() => users(data.value));
    await mountCollection({
      items: items.value,
      root: reactive<Props>({ items, defaultOpen: true }),
    });
    await opened();
    expect(itemNames()).toEqual([]);
    data.value = USERS;
    await waitFor(() => expect(itemNames()).toEqual(['Ann', 'Bob', 'Cal']));
  });

  test('the label accessor runs for the selected value only, before the open', async () => {
    const labels: number[] = [];
    await mountCollection({
      inputInPopup: true,
      items: Combobox.createItems(USERS, {
        getValue: (user) => user.id,
        getLabel: (user) => {
          labels.push(user.id);
          return user.name;
        },
      }),
      root: { defaultValue: 3 },
    });
    expect(trigger()).toHaveTextContent('Cal');
    expect(new Set(labels)).toEqual(new Set([3]));
  });
});

describe('the filter of a collection', () => {
  test('reads the label of the collection, also with `itemToStringLabel`', async () => {
    await mountCollection({
      items: users(USERS),
      root: { itemToStringLabel: (value: number) => `User ${value}` },
    });
    await userEvent.type(input(), 'bo');
    await waitFor(() => expect(itemNames()).toEqual(['Bob']));
  });

  test('a custom filter gets the source items and can read their other fields; `limit` cuts the result', async () => {
    const seen: unknown[] = [];
    await mountCollection({
      items: users(USERS),
      root: {
        limit: 1,
        filter: (user: User, query: string) => {
          seen.push(user);
          return user.team === query;
        },
      },
    });
    await userEvent.type(input(), 'red');
    await waitFor(() => expect(itemNames()).toEqual(['Ann']));
    expect(seen).toContain(USERS[0]);
  });

  test('grouped data: the value is derived and has its label while closed', async () => {
    const groups = [
      { name: 'red', items: [USERS[0]!, USERS[2]!] },
      { name: 'blue', items: [USERS[1]!] },
    ];
    await mountCollection({
      inputInPopup: true,
      items: Combobox.createItems(groups, {
        getValue: (user) => user.id,
        getLabel: (user) => user.name,
      }),
      root: { defaultValue: 3 },
    });
    expect(trigger()).toHaveTextContent('Cal');
  });
});

describe('an external window of `filteredItems`', () => {
  test('labels a value from the window, follows a new window, and gives a pick the derived value', async () => {
    const root = reactive<Props>({ filteredItems: [USERS[1]], defaultValue: 2, multiple: false });
    const values: unknown[] = [];
    root['onUpdate:modelValue'] = (value: unknown) => values.push(value);
    await mountCollection({ inputInPopup: true, items: users([]), root });
    expect(trigger()).toHaveTextContent('Bob');
    root.filteredItems = [{ id: 2, name: 'Robert' }];
    await nextTick();
    expect(trigger()).toHaveTextContent('Robert');
    root.filteredItems = [USERS[2]];
    await nextTick();
    expect(trigger()).toHaveTextContent('2');
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item(3));
    expect(values).toEqual([3]);
  });

  test('labels each value of `multiple` from the window', async () => {
    await mountCollection({
      inputInPopup: true,
      items: users([]),
      root: { multiple: true, filteredItems: USERS, defaultValue: [1, 3] },
    });
    expect(trigger()).toHaveTextContent('Ann, Cal');
  });

  test('opens a reordered window at the selected value', async () => {
    await mountCollection({
      items: users(USERS),
      root: { filteredItems: [USERS[2], USERS[0]], defaultValue: 1 },
    });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Ann'));
    expect(itemNames()).toEqual(['Cal', 'Ann']);
  });
});

describe('the data of a collection', () => {
  test('an `items` field that is not a list is item data, and an item with no value renders as an item', async () => {
    const data = [
      { id: null as number | null, name: 'Nobody', items: 'none' },
      { id: 1, name: 'Ann', items: 'one' },
    ];
    await mountCollection({
      items: Combobox.createItems(data, {
        getValue: (each) => each.id as number,
        getLabel: (each) => each.name,
      }),
      root: { defaultOpen: true },
    });
    await opened();
    expect(itemNames()).toEqual(['Nobody', 'Ann']);
    await settle();
  });
});
