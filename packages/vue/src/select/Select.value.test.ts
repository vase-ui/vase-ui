import { describe, expect, inject, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { h, nextTick, reactive } from 'vue';
import type { SelectRootChangeEventDetails } from '@vase-ui/vue/select';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
type Item = { value: unknown; text: string; label?: string; disabled?: boolean };

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const item = (value: string) => byTestId(`item-${value}`);
const valueText = () => byTestId('value').textContent;
const shown = (element: HTMLElement | null) => !!element?.checkVisibility();
const selected = () =>
  [...popup().querySelectorAll('[role="option"][aria-selected="true"]')].map(
    (option) => option.textContent,
  );
const itemsOf = (...values: string[]): Item[] => values.map((value) => ({ value, text: value }));

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  await waitFor(() => expect(byTestId('positioner').style.opacity).toBe(''));
}

async function closed() {
  await waitFor(() => expect(shown(popup())).toBe(false));
}

describe('a controlled value', () => {
  test('selects its item; a new value of the parent selects the new item; a pick that the parent does not write keeps the item', async () => {
    const changes: unknown[] = [];
    const root = reactive<Props>({
      modelValue: 'apricot',
      onValueChange: (value: unknown) => changes.push(value),
    });
    await mountSelect({ root });
    await userEvent.click(trigger());
    await opened();
    expect(selected()).toEqual(['Apricot']);
    root.modelValue = 'banana';
    await nextTick();
    expect(selected()).toEqual(['Banana']);
    expect(valueText()).toBe('banana');
    await userEvent.click(item('cherry'));
    await closed();
    expect(changes).toEqual(['cherry']);
    expect(valueText()).toBe('banana');
    await userEvent.click(trigger());
    await opened();
    expect(selected()).toEqual(['Banana']);
  });

  test('a value that is open at the mount selects its item', async () => {
    await mountSelect({ root: { modelValue: 'banana', defaultOpen: true } });
    await opened();
    expect(selected()).toEqual(['Banana']);
  });

  test.each([
    { name: 'single', multiple: false, first: 'dave', next: 'bob' },
    { name: 'multiple', multiple: true, first: ['dave'], next: ['bob'] },
  ])(
    '$name: a new value and new items in one update keep the focus and the highlight, and emit no valueChange',
    async ({ multiple, first, next }) => {
      const changes: unknown[] = [];
      const items = reactive(itemsOf('alice', 'bob', 'carol', 'dave'));
      const root = reactive<Props>({
        multiple,
        modelValue: first,
        open: true,
        modal: false,
        onValueChange: (value: unknown) => changes.push(value),
      });
      await mountSelect({ root, items });
      await opened();
      expect(selected()).toEqual(['dave']);
      item('alice').focus();
      await waitFor(() => expect(item('alice')).toHaveAttribute('data-highlighted', ''));
      items.splice(2, 2);
      root.modelValue = next;
      await nextTick();
      await wait(20);
      expect(selected()).toEqual(['bob']);
      expect(changes).toEqual([]);
      expect(document.activeElement).toBe(item('alice'));
      expect(item('alice')).toHaveAttribute('data-highlighted', '');
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).toBe(item('bob')));
    },
  );

  test('a new `multiple`, value and items in one update emit no valueChange', async () => {
    const changes: unknown[] = [];
    const items = reactive(itemsOf('alice', 'bob', 'carol'));
    const root = reactive<Props>({
      modelValue: 'bob',
      open: true,
      onValueChange: (value: unknown) => changes.push(value),
    });
    await mountSelect({ root, items });
    await opened();
    expect(popup()).not.toHaveAttribute('aria-multiselectable');
    root.multiple = true;
    root.modelValue = ['alice'];
    items.splice(2, 1);
    await nextTick();
    await wait(20);
    expect(popup()).toHaveAttribute('aria-multiselectable', 'true');
    expect(item('carol')).toBe(null);
    expect(selected()).toEqual(['alice']);
    expect(changes).toEqual([]);
  });

  test('a new `isItemEqualToValue`, value and items in one update emit no valueChange', async () => {
    const changes: unknown[] = [];
    const alice = { id: 'alice' };
    const bob = { id: 'bob' };
    const items = reactive([
      { value: alice, text: 'alice' },
      { value: bob, text: 'bob' },
    ]);
    const root = reactive<Props>({
      modelValue: alice,
      open: true,
      itemToStringValue: (value: { id: string }) => value.id,
      onValueChange: (value: unknown) => changes.push(value),
    });
    await mountSelect({ root, items });
    await opened();
    root.isItemEqualToValue = (a: { id: string }, b: { id: string }) => a.id === b.id;
    root.modelValue = { id: 'bob' };
    items.splice(
      0,
      2,
      { value: { id: 'alice' }, text: 'alice' },
      { value: { id: 'bob' }, text: 'bob' },
    );
    await nextTick();
    await wait(20);
    expect(selected()).toEqual(['bob']);
    expect(changes).toEqual([]);
  });

  test('a controlled multiple value that the parent changes while open selects the new items', async () => {
    const root = reactive<Props>({ multiple: true, modelValue: ['apple', 'banana'] });
    await mountSelect({ root });
    await userEvent.click(trigger());
    await opened();
    expect(selected()).toEqual(['Apple', 'Banana']);
    root.modelValue = ['banana'];
    await nextTick();
    expect(selected()).toEqual(['Banana']);
    root.modelValue = ['apple', 'banana', 'cherry'];
    await nextTick();
    expect(selected()).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  test('`null` with no null item shows the default slot of Select.Value, and selects no item', async () => {
    const root = reactive<Props>({ modelValue: null });
    await mountSelect({
      root,
      valueSlot: (value: unknown) => (value == null ? 'initial' : (value as string)),
    });
    expect(valueText()).toBe('initial');
    root.modelValue = 'apricot';
    await nextTick();
    expect(valueText()).toBe('apricot');
    root.modelValue = 'banana';
    await nextTick();
    root.modelValue = null;
    await nextTick();
    expect(valueText()).toBe('initial');
    await userEvent.click(trigger());
    await opened();
    expect(selected()).toEqual([]);
  });

  test('a value of a script mounts no popup', async () => {
    const root = reactive<Props>({ modelValue: null, items: { banana: 'Banana' } });
    await mountSelect({ root });
    root.modelValue = 'banana';
    await nextTick();
    await wait(20);
    expect(popup()).toBe(null);
    expect(valueText()).toBe('Banana');
  });

  test('a pick of an object item shows the text of `itemToStringLabel`', async () => {
    await mountSelect({
      root: { itemToStringLabel: (value: { name: string }) => value.name },
      items: [
        { value: { code: 'US', name: 'United States' }, text: 'United States' },
        { value: { code: 'CA', name: 'Canada' }, text: 'Canada' },
      ],
    });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(popup().querySelectorAll<HTMLElement>('[role="option"]')[1]!);
    await closed();
    expect(valueText()).toBe('Canada');
  });

  test('`isItemEqualToValue` gets the value of the item first, and the selected value second', async () => {
    type User = { id: number; from: string };
    await mountSelect({
      root: {
        multiple: true,
        defaultOpen: true,
        defaultValue: [{ id: 2, from: 'value' }],
        isItemEqualToValue: (a: User, b: User) =>
          a.id === b.id && a.from === 'item' && b.from === 'value',
      },
      items: [
        { value: { id: 1, from: 'item' }, text: 'one' },
        { value: { id: 2, from: 'item' }, text: 'two' },
      ],
    });
    await opened();
    expect(selected()).toEqual(['two']);
    await userEvent.click(popup().querySelectorAll<HTMLElement>('[role="option"]')[1]!);
    await waitFor(() => expect(selected()).toEqual([]));
  });
});

describe('Select.Value', () => {
  test('the default slot gets the value, and its content wins over the label, the items and the placeholder', async () => {
    const root = reactive<Props>({ items: { apple: 'Red apple' }, defaultValue: 'apple' });
    const { unmount } = await mountSelect({
      root,
      valueSlot: (value: unknown) => `slot ${String(value)}`,
      value: { placeholder: 'Pick' },
    });
    expect(valueText()).toBe('slot apple');
    unmount();
    await mountSelect({ root: {}, valueSlot: 'Fixed text', value: { placeholder: 'Pick' } });
    expect(valueText()).toBe('Fixed text');
  });

  test('with `multiple`, the default slot gets the array, also the empty array with no value', async () => {
    const root = reactive<Props>({ multiple: true, defaultValue: ['a', 'b'] });
    const { unmount } = await mountSelect({
      root,
      valueSlot: (value: unknown) => JSON.stringify(value),
    });
    expect(valueText()).toBe('["a","b"]');
    unmount();
    await mountSelect({
      root: { multiple: true },
      valueSlot: (value: unknown) => JSON.stringify(value),
    });
    expect(valueText()).toBe('[]');
  });

  test.each([
    { name: 'a record', items: { apple: 'Red apple', banana: 'Yellow banana' } },
    {
      name: 'an array',
      items: [
        { value: 'apple', label: 'Red apple' },
        { value: 'banana', label: 'Yellow banana' },
      ],
    },
  ])(
    'follows the value with the labels of $name, and shows a value with no label as text',
    async ({ items }) => {
      const root = reactive<Props>({ items, modelValue: 'apple' });
      await mountSelect({ root });
      expect(valueText()).toBe('Red apple');
      root.modelValue = 'banana';
      await nextTick();
      expect(valueText()).toBe('Yellow banana');
      root.modelValue = 'kiwi';
      await nextTick();
      expect(valueText()).toBe('kiwi');
      root.multiple = true;
      root.modelValue = ['apple', 'banana'];
      await nextTick();
      expect(valueText()).toBe('Red apple, Yellow banana');
      root.modelValue = ['banana'];
      await nextTick();
      expect(valueText()).toBe('Yellow banana');
      root.modelValue = [];
      await nextTick();
      expect(valueText()).toBe('');
    },
  );

  test('follows a new array of items', async () => {
    const root = reactive<Props>({
      items: [{ value: 'apple', label: 'Apple' }],
      defaultValue: 'apple',
    });
    await mountSelect({ root });
    expect(valueText()).toBe('Apple');
    root.items = [{ value: 'apple', label: 'Green apple' }];
    await nextTick();
    expect(valueText()).toBe('Green apple');
  });

  // A Vapor app with no interop plugin has no virtual DOM, so a label function that returns vnodes
  // renders nothing in a part that compiles as Vapor.
  const pureVapor = inject('app') === 'vapor';

  test.skipIf(pureVapor)(
    'VUE-36: a label function renders its content for a value, and for each value of `multiple`',
    async () => {
      const root = reactive<Props>({
        items: {
          apple: () => h('b', 'Apple'),
          banana: () => h('i', 'Banana'),
        },
        defaultValue: 'apple',
      });
      const { unmount } = await mountSelect({ root });
      expect(byTestId('value').querySelector('b')).toHaveTextContent('Apple');
      expect(valueText()).toBe('Apple');
      unmount();
      await mountSelect({
        root: { ...root, multiple: true, defaultValue: ['apple', 'banana'] },
      });
      expect(byTestId('value').querySelector('b')).toHaveTextContent('Apple');
      expect(byTestId('value').querySelector('i')).toHaveTextContent('Banana');
    },
  );

  test.skipIf(pureVapor)('VUE-36: a placeholder function renders its content', async () => {
    await mountSelect({
      value: { placeholder: () => h('span', { 'data-testid': 'placeholder' }, 'Pick one') },
    });
    expect(byTestId('placeholder')).toHaveTextContent('Pick one');
    expect(byTestId('value')).toHaveAttribute('data-placeholder', '');
  });

  test.each([
    {
      name: 'a null item with no label',
      items: [
        { value: null, label: null },
        { value: 'a', label: 'A' },
      ],
      text: 'Pick',
    },
    { name: 'a record with no null key', items: { a: 'A', b: 'B' }, text: 'Pick' },
    { name: 'a null item with a label', items: [{ value: null, label: 'None' }], text: 'None' },
  ])('with $name and no value, shows "$text"', async ({ items, text }) => {
    await mountSelect({ root: { items }, value: { placeholder: 'Pick' } });
    expect(valueText()).toBe(text);
    expect(trigger()).toHaveAttribute('data-placeholder', '');
    expect(byTestId('value')).toHaveAttribute('data-placeholder', '');
  });

  test('a value shows its label and no placeholder, and neither part has `data-placeholder`', async () => {
    const root = reactive<Props>({ defaultValue: 'a' });
    const { unmount } = await mountSelect({ root, value: { placeholder: 'Pick' } });
    expect(valueText()).toBe('a');
    expect(trigger()).not.toHaveAttribute('data-placeholder');
    expect(byTestId('value')).not.toHaveAttribute('data-placeholder');
    unmount();
    await mountSelect({ root: { multiple: true, defaultValue: ['a'] } });
    expect(trigger()).not.toHaveAttribute('data-placeholder');
    expect(byTestId('value')).not.toHaveAttribute('data-placeholder');
  });

  test('a value whose form text is empty is a placeholder that shows its label', async () => {
    await mountSelect({
      root: {
        defaultValue: { id: '', name: 'Default' },
        itemToStringValue: (value: { id: string }) => value.id,
        itemToStringLabel: (value: { name: string }) => value.name,
      },
    });
    expect(trigger()).toHaveAttribute('data-placeholder', '');
    expect(byTestId('value')).toHaveAttribute('data-placeholder', '');
    expect(valueText()).toBe('Default');
  });
});

describe('items that change', () => {
  test.each([
    { name: 'the selected item', next: ['apple', 'banana', 'date'], value: null },
    { name: 'each item', next: ['x', 'y', 'z'], value: null },
    { name: 'no item: a new order', next: ['cherry', 'apple', 'banana'], value: 'cherry' },
  ])('a replace of $name with the same count gives the value $value', async ({ next, value }) => {
    const changes: unknown[] = [];
    const items = reactive(itemsOf('apple', 'banana', 'cherry'));
    const root = reactive<Props>({
      modelValue: 'cherry',
      onValueChange: (changed: unknown, details: SelectRootChangeEventDetails) => {
        changes.push(changed);
        expect(details.reason).toBe('none');
      },
      'onUpdate:modelValue': (changed: unknown) => (root.modelValue = changed),
    });
    await mountSelect({ root, items });
    await userEvent.click(trigger());
    await opened();
    items.splice(0, 3, ...itemsOf(...next));
    await wait(20);
    expect(changes).toEqual(value === 'cherry' ? [] : [value]);
    expect(selected()).toEqual(value === 'cherry' ? ['cherry'] : []);
  });

  test('with `multiple`, a replaced item leaves the value', async () => {
    const changes: unknown[] = [];
    const items = reactive(itemsOf('a', 'b', 'c'));
    await mountSelect({
      root: {
        multiple: true,
        defaultValue: ['a', 'c'],
        defaultOpen: true,
        onValueChange: (value: unknown) => changes.push(value),
      },
      items,
    });
    await opened();
    items.splice(2, 1, { value: 'd', text: 'd' });
    await waitFor(() => expect(changes).toEqual([['a']]));
    expect(selected()).toEqual(['a']);
  });

  test('a controlled root whose item leaves gets the first value, then null, through valueChange', async () => {
    const changes: unknown[] = [];
    const items = reactive(itemsOf('a', 'b', 'c'));
    const root = reactive<Props>({
      modelValue: 'b',
      onValueChange: (value: unknown) => changes.push(value),
      'onUpdate:modelValue': (value: unknown) => (root.modelValue = value),
    });
    await mountSelect({ root, items });
    trigger().focus();
    await waitFor(() => expect(item('a')).not.toBe(null));
    root.modelValue = 'c';
    await nextTick();
    items.splice(2, 1);
    await waitFor(() => expect(changes).toEqual(['b']));
    expect(valueText()).toBe('b');
    items.splice(1, 1);
    await waitFor(() => expect(changes).toEqual(['b', null]));
    await userEvent.click(trigger());
    await opened();
    expect(selected()).toEqual([]);
  });

  test('the keys skip an item that a `v-if` leaves out', async () => {
    const items = reactive(itemsOf('apple', 'banana', 'cherry'));
    await mountSelect({ items });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(item('apple')));
    items.splice(1, 1);
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(item('cherry')));
    await userEvent.keyboard('{ArrowDown}');
    await wait(20);
    expect(document.activeElement).toBe(item('cherry'));
  });
});
