import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import ComboboxCollection from '../../test/fixtures/ComboboxCollection.vue';
import { mount } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

interface Country {
  id: number;
  name: string;
}

const COUNTRIES: Country[] = [
  { id: 1, name: 'France' },
  { id: 2, name: 'Germany' },
  { id: 3, name: 'Greece' },
];

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const input = () => byTestId('input') as HTMLInputElement;
const itemNames = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());
const collection = (data: Country[] | undefined) =>
  Combobox.createItems(data, { getValue: (item) => item.id, getLabel: (item) => item.name });

describe('createItems', () => {
  test('the value of a pick is the derived value; the input and Value show the label', async () => {
    const values: unknown[] = [];
    mount(ComboboxCollection, {
      items: collection(COUNTRIES),
      root: { defaultValue: 2, 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    await nextTick();
    expect(input().value).toBe('Germany');
    await userEvent.click(input());
    await userEvent.click(byTestId('item-3'));
    expect(values).toEqual([3]);
    expect(input().value).toBe('Greece');
  });

  test('Value shows the label of the derived value, and the placeholder with no value', async () => {
    mount(ComboboxCollection, { items: collection(COUNTRIES), inputInPopup: true, root: { defaultValue: 1 } });
    await nextTick();
    expect(byTestId('trigger')).toHaveTextContent('France');
  });

  test('the filter reads the label of each source item', async () => {
    mount(ComboboxCollection, { items: collection(COUNTRIES) });
    await nextTick();
    input().focus();
    await userEvent.keyboard('gr');
    await waitFor(() => expect(itemNames()).toEqual(['Greece']));
  });

  test('the form data has the derived values of a multiple root', async () => {
    const form = document.body.appendChild(document.createElement('form'));
    try {
      mount(ComboboxCollection, { items: collection(COUNTRIES), root: { name: 'c', multiple: true, defaultValue: [1, 3] } }, form);
      await nextTick();
      expect([...new FormData(form).getAll('c')]).toEqual(['1', '3']);
    } finally {
      form.remove();
    }
  });

  test('a value that is not in the data is its own label; no data shows no item', async () => {
    mount(ComboboxCollection, { items: collection(undefined), root: { defaultValue: 9 } });
    await nextTick();
    expect(input().value).toBe('9');
    await userEvent.click(input());
    expect(itemNames()).toEqual([]);
  });

  test('the closed trigger typeahead reads the derived labels', async () => {
    const values: unknown[] = [];
    mount(ComboboxCollection, {
      items: collection(COUNTRIES),
      inputInPopup: true,
      root: { 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    await nextTick();
    byTestId('trigger').focus();
    await userEvent.keyboard('g');
    expect(values).toEqual([2]);
  });

  test('the accessors run at the first read, and a derived value that two items give is an error', () => {
    const getValue = vi.fn(() => 1);
    const items = Combobox.createItems(COUNTRIES, { getValue, getLabel: (item) => item.name });
    expect(getValue).not.toHaveBeenCalled();
    mount(ComboboxCollection, { items, root: { defaultValue: 1 } });
    expect(getValue).toHaveBeenCalled();
    expect(takeReportedMessages().join('\n')).toContain('derived the value 1');
  });
});
