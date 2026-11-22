import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import { fireEvent } from '../../test/fireEvent';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const textInput = () => document.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;
const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());

/** Fills the hidden text input as a browser autofill does. */
async function autofill(text: string) {
  textInput().value = text;
  textInput().dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
];

describe('an autofill of the hidden text input', () => {
  test('selects the item whose value is the text, keeps an open popup open, and the next open shows each item', async () => {
    const first = mount(ComboboxParts, {
      items: ['a', 'b', 'c'],
      root: { name: 'test', defaultOpen: true },
    });
    await opened();
    await autofill('b');
    await settle();
    expect(popup()).not.toBe(null);
    first.unmount();
    mount(ComboboxParts, { items: ['a', 'b', 'c'], root: { name: 'test' } });
    await autofill('b');
    expect(input().value).toBe('b');
    await userEvent.click(input());
    await opened();
    expect(options()).toEqual(['a', 'b', 'c']);
  });

  test('selects an object item by its value or by its label', async () => {
    for (const text of ['CA', 'Canada']) {
      const changes: { value: unknown; reason: string }[] = [];
      const { unmount } = mount(ComboboxStatic, {
        root: {
          name: 'country',
          items: COUNTRIES.map((country) => ({ value: country.code, label: country.name })),
          onValueChange: (value: unknown, details: { reason: string }) =>
            changes.push({ value, reason: details.reason }),
        },
      });
      await nextTick();
      await autofill(text);
      expect(changes).toEqual([{ value: { value: 'CA', label: 'Canada' }, reason: 'none' }]);
      unmount();
    }
  });

  test('with no `items` and a popup that is not kept, matches the text of the items with no regard to case, the value first', async () => {
    for (const [items, texts, text, picked] of [
      [['US', 'CA'], { US: 'United States', CA: 'Canada' }, 'canada', 'CA'],
      [['CA', 'US'], { CA: 'US', US: 'United States' }, 'US', 'US'],
      [['US', 'CA'], { US: '', CA: 'Canada' }, 'Canada', 'CA'],
    ] as const) {
      const { unmount } = mount(ComboboxStatic, { items, texts, root: { name: 'country' } });
      await nextTick();
      expect(popup()).toBe(null);
      await autofill(text);
      await waitFor(() => expect(item(picked)).toHaveAttribute('aria-selected', 'true'));
      unmount();
    }
  });

  test('with no `items`, the popup stays in the DOM, hidden and inert, from the first fill', async () => {
    mount(ComboboxStatic, {
      items: ['US', 'CA'],
      texts: { US: 'United States', CA: 'Canada' },
      root: { name: 'country' },
    });
    await nextTick();
    await autofill('Canada');
    await waitFor(() => expect(item('CA')).toHaveAttribute('aria-selected', 'true'));
    expect(popup()).toHaveAttribute('hidden');
    expect(popup()).toHaveAttribute('inert');
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toHaveAttribute('hidden'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    expect(item('US')).not.toBe(null);
  });

  test('VUE-224: with `items`, a text that only the rendered item shows selects nothing and mounts no list; `itemToStringLabel` gives the match', async () => {
    const names: Record<string, string> = { US: 'United States', CA: 'Canada' };
    for (const itemToStringLabel of [undefined, (code: string) => names[code]!]) {
      const changes: unknown[] = [];
      const { unmount } = mount(ComboboxStatic, {
        items: ['US', 'CA'],
        texts: names,
        root: {
          name: 'country',
          items: ['US', 'CA'],
          itemToStringLabel,
          onValueChange: (value: unknown) => changes.push(value),
        },
      });
      await nextTick();
      await autofill('Canada');
      await settle();
      expect(changes).toEqual(itemToStringLabel ? ['CA'] : []);
      expect(document.querySelector('[role="listbox"]')).toBe(null);
      unmount();
    }
  });

  test('with `items`, a match of the value mounts no list', async () => {
    mount(ComboboxParts, { items: ['US', 'CA'], root: { name: 'country' } });
    await nextTick();
    await autofill('CA');
    expect(document.querySelector('[role="listbox"]')).toBe(null);
    await userEvent.click(input());
    await opened();
    expect(item('CA')).toHaveAttribute('aria-selected', 'true');
  });

  test('an autofill in a field makes the field dirty and validates it', async () => {
    const validated: unknown[] = [];
    mount(ComboboxStatic, {
      items: ['US', 'CA'],
      field: {
        validationMode: 'change',
        validate: (value: unknown) => {
          validated.push(value);
          return null;
        },
      },
      root: { name: 'country', items: ['US', 'CA'] },
    });
    await nextTick();
    expect(input()).not.toHaveAttribute('data-dirty');
    await autofill('CA');
    await settle();
    expect(validated.at(-1)).toBe('CA');
    expect(input()).toHaveAttribute('data-dirty', '');
  });

  test('an autofill that a listener cancels leaves the field as it was', async () => {
    mount(ComboboxStatic, {
      items: ['US', 'CA'],
      inputInPopup: true,
      field: { name: 'country' },
      root: {
        items: ['US', 'CA'],
        onValueChange: (_: unknown, details: { cancel(): void }) => details.cancel(),
      },
    });
    await nextTick();
    await autofill('CA');
    await settle();
    expect(byTestId('trigger')).not.toHaveAttribute('data-dirty');
    expect(byTestId('trigger')).toHaveTextContent('');
  });

  test.each([{ readonly: true }, { disabled: true }])(
    'of a root with $0 changes no value and no text',
    async (lock) => {
      const changes: unknown[] = [];
      mount(ComboboxParts, {
        items: ['a', 'b'],
        root: {
          ...lock,
          name: 'test',
          onValueChange: (value: unknown) => changes.push(value),
          onInputValueChange: (text: unknown) => changes.push(text),
        },
      });
      await nextTick();
      await autofill('b');
      await settle();
      expect(changes).toEqual([]);
      expect(input().value).toBe('');
    },
  );

  test('gets the autofill purpose of `autocomplete`, the name and `readonly`; the input has neither', async () => {
    mount(ComboboxParts, { root: { name: 'country', autocomplete: 'country', readonly: true } });
    await nextTick();
    expect(input()).toHaveAttribute('autocomplete', 'off');
    expect(input()).not.toHaveAttribute('name');
    expect(textInput()).toHaveAttribute('autocomplete', 'country');
    expect(textInput()).toHaveAttribute('readonly');
    expect(document.querySelector('input[name="country"]')).not.toBe(null);
  });

  test('with `multiple`, `itemToStringValue` gives the form text of each value', async () => {
    const countries = [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
    ];
    mount(ComboboxParts, {
      items: countries,
      root: {
        name: 'countries',
        multiple: true,
        defaultValue: countries,
        itemToStringValue: (value: { code: string }) => value.code,
      },
    });
    await nextTick();
    const named = [...document.querySelectorAll<HTMLInputElement>('input[name="countries"]')];
    expect(named.map((each) => each.value)).toEqual(['US', 'CA']);
    expect(named.every((each) => each.localName === 'input')).toBe(true);
  });
});

describe('an `input` event of the visible input', () => {
  test('an autofill with `insertReplacementText` opens no popup, and the next open filters no item', async () => {
    mount(ComboboxParts, { items: ['a', 'b', 'c'], root: { name: 'test', defaultValue: 'b' } });
    await nextTick();
    input().value = 'B';
    await fireEvent.input(input(), { inputType: 'insertReplacementText' });
    await settle();
    expect(input().value).toBe('B');
    expect(popup()).toBe(null);
    await userEvent.click(input());
    await opened();
    expect(options()).toEqual(['a', 'b', 'c']);
  });

  test('a paste opens the popup', async () => {
    mount(ComboboxParts, {});
    await nextTick();
    input().value = 'Apple';
    await fireEvent.input(input(), { inputType: 'insertFromPaste' });
    await opened();
  });
});
