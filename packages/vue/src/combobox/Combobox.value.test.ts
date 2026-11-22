import { describe, expect, inject, test } from 'vitest';
import { h, nextTick, reactive } from 'vue';
import ComboboxValueScene from '../../test/fixtures/ComboboxValueScene.vue';
import { mount } from '../../test/render';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const valueText = () => byTestId('value').textContent!.trim();

async function mountValue(props: Props = {}) {
  const result = mount(ComboboxValueScene, props);
  await nextTick();
  return result;
}

// A Vapor app with no interop plugin has no virtual DOM, so a label function that returns vnodes
// renders nothing in a part that compiles as Vapor.
const pureVapor = inject('app') === 'vapor';

describe('the default slot', () => {
  test('gets the value: a string, `null` with no value, and an object', async () => {
    const show = (value: string | null) => value ?? 'null';
    const first = await mountValue({ root: { defaultValue: 'b' }, valueSlot: show });
    expect(valueText()).toBe('b');
    first.unmount();
    const second = await mountValue({ valueSlot: show });
    expect(valueText()).toBe('null');
    second.unmount();
    const complex = { id: 1, name: 'Test', nested: { data: 'value' } };
    await mountValue({
      root: { defaultValue: complex },
      valueSlot: (value: typeof complex | null) => (value ? `${value.name} (${value.id})` : 'No'),
    });
    expect(valueText()).toBe('Test (1)');
  });

  test('a static text or markup replaces the label of the value', async () => {
    const first = await mountValue({
      root: { defaultValue: 'test-value' },
      valueSlot: 'Custom Display Text',
    });
    expect(valueText()).toBe('Custom Display Text');
    first.unmount();
    await mountValue({ root: { defaultValue: 'test' }, valueSlot: 'markup' });
    expect(byTestId('markup').querySelector('strong')).toHaveTextContent('Bold');
    expect(byTestId('markup').querySelector('em')).toHaveTextContent('italic');
  });

  test('wins over the placeholder, also a function that gives its own text for no value', async () => {
    const first = await mountValue({
      value: { placeholder: 'Select an option' },
      valueSlot: 'Custom Text',
    });
    expect(valueText()).toBe('Custom Text');
    first.unmount();
    await mountValue({
      value: { placeholder: 'Select an option' },
      valueSlot: (value: unknown) => (value as string | null) || 'Function fallback',
    });
    expect(valueText()).toBe('Function fallback');
  });
});

describe('the label of the value', () => {
  test.each([
    { name: 'a string', value: 'test-string', text: 'test-string' },
    { name: 'a number', value: 42, text: '42' },
    { name: 'a Boolean', value: true, text: 'true' },
  ])('of $name with no items is its text', async ({ value, text }) => {
    await mountValue({ root: { defaultValue: value } });
    expect(valueText()).toBe(text);
  });

  test('`itemToStringLabel` gives the label of an object value', async () => {
    const complex = { id: 1, name: 'Test Item' };
    await mountValue({
      root: {
        defaultValue: complex,
        itemToStringLabel: (item: { name: string }) => `Custom: ${item.name}`,
      },
    });
    expect(valueText()).toBe('Custom: Test Item');
  });

  test('the first item of a duplicate value gives the label', async () => {
    const items = [
      { value: 'test', label: 'First Label' },
      { value: 'test', label: 'Second Label' },
      { value: 'other', label: 'Other' },
    ];
    await mountValue({ items, root: { defaultValue: items[0] } });
    expect(valueText()).toBe('First Label');
  });

  test('follows a new label of the same item, and a new item', async () => {
    const a = reactive({ value: 'a', label: 'a' });
    const b = { value: 'b', label: 'b' };
    const root = reactive<Props>({ modelValue: a });
    const items = reactive<unknown[]>([a, b]);
    await mountValue({ items, root });
    expect(valueText()).toBe('a');
    a.label = 'a new';
    const c = { value: 'c', label: 'Label c' };
    items.push(c);
    await nextTick();
    expect(valueText()).toBe('a new');
    root.modelValue = c;
    await nextTick();
    expect(valueText()).toBe('Label c');
  });

  test('a value in a group of the items shows the label of its item', async () => {
    const items = [
      {
        value: 'fonts',
        items: [
          { value: 'sans', label: 'Sans-serif' },
          { value: 'serif', label: 'Serif' },
        ],
      },
      {
        value: 'sizes',
        items: [
          { value: 'small', label: 'Small' },
          { value: 'large', label: 'Large' },
        ],
      },
    ];
    await mountValue({ items, root: { defaultValue: items[0]!.items[1] } });
    expect(valueText()).toBe('Serif');
  });

  test('with `multiple`, the labels of the items with commas, else the values', async () => {
    const items = [
      { value: 'sans', label: 'Sans-serif' },
      { value: 'serif', label: 'Serif' },
      { value: 'mono', label: 'Monospace' },
    ];
    const first = await mountValue({
      items,
      root: { multiple: true, defaultValue: [items[0], items[1]] },
    });
    expect(valueText()).toBe('Sans-serif, Serif');
    first.unmount();
    await mountValue({ root: { multiple: true, defaultValue: ['serif', 'mono'] } });
    expect(valueText()).toBe('serif, mono');
  });

  test.skipIf(pureVapor)(
    'VUE-36: a label function of a value, of the items and of each value of `multiple` renders its content',
    async () => {
      const own = { value: 'test', label: () => h('span', { 'data-testid': 'node' }, 'Label') };
      const first = await mountValue({ root: { defaultValue: own } });
      expect(byTestId('node')).toHaveTextContent('Label');
      first.unmount();
      const items = [
        { value: 'bold', label: () => h('strong', 'Bold Text') },
        { value: 'italic', label: () => h('em', 'Italic Text') },
      ];
      const second = await mountValue({ items, root: { defaultValue: items[0] } });
      expect(byTestId('value').querySelector('strong')).toHaveTextContent('Bold Text');
      second.unmount();
      await mountValue({ items, root: { multiple: true, defaultValue: items } });
      expect(byTestId('value').querySelector('strong')).toHaveTextContent('Bold Text');
      expect(byTestId('value').querySelector('em')).toHaveTextContent('Italic Text');
      expect(valueText()).toBe('Bold Text, Italic Text');
    },
  );
});

describe('the placeholder', () => {
  test.each([
    {
      name: 'a null item with a label, with the input in the popup',
      items: [
        { value: null, label: 'Select item' },
        { value: 'a', label: 'A' },
      ],
      value: {},
      text: 'Select item',
    },
    {
      name: 'a null item with a label in a group',
      items: [
        {
          value: 'options',
          items: [
            { value: null, label: 'None selected' },
            { value: 'option1', label: 'Option 1' },
          ],
        },
      ],
      value: {},
      text: 'None selected',
    },
    {
      name: 'a null item with a label, and a placeholder',
      items: [
        { value: null, label: 'None' },
        { value: 'option1', label: 'Option 1' },
      ],
      value: { placeholder: 'Select an option' },
      text: 'None',
    },
    {
      name: 'a null item with no label, and a placeholder',
      items: [
        { value: null, label: null },
        { value: 'option1', label: 'Option 1' },
      ],
      value: { placeholder: 'Select an option' },
      text: 'Select an option',
    },
  ])('with $name and no value, the value shows "$text"', async ({ items, value, text }) => {
    await mountValue({ items, value });
    expect(valueText()).toBe(text);
  });

  test('shows for an empty multiple value', async () => {
    await mountValue({
      root: { multiple: true, defaultValue: [] },
      value: { placeholder: 'Select options' },
    });
    expect(valueText()).toBe('Select options');
  });

  test.skipIf(pureVapor)('VUE-36: a placeholder function renders its content', async () => {
    await mountValue({
      value: { placeholder: () => h('span', { 'data-testid': 'placeholder' }, 'Select one') },
    });
    expect(byTestId('placeholder')).toHaveTextContent('Select one');
  });
});
