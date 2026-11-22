import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ComboboxInField from '../../test/fixtures/ComboboxInField.vue';
import { submitsPrevented, mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const named = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map(
    (each) => each.value,
  );

async function mountField(props: Props = {}) {
  const result = mount(ComboboxInField, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('a combobox in a form', () => {
  test('an error of the form on a trigger that is the control: a submit gives the trigger the focus and shows the error', async () => {
    await mountField({
      inputInPopup: true,
      field: { name: 'fruit' },
      root: { required: true },
    });
    await userEvent.click(byTestId('submit')!);
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    expect(byTestId('error')).not.toBe(null);
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
  });

  test('Enter on a highlighted item picks it and submits no form', async () => {
    await mountField({ field: { name: 'fruit' } });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await closed();
    expect(input().value).toBe('Apple');
    expect(submitsPrevented).toEqual([]);
  });
});

describe('a combobox in a field', () => {
  test('gets the name of the field', async () => {
    await mountField({ field: { name: 'fruit' }, root: { defaultValue: 'Banana' } });
    expect(named('fruit')).toEqual(['Banana']);
  });

  test('the label of the field and Combobox.Label name a trigger that is the control and has its own id; a press on Combobox.Label focuses it and opens nothing', async () => {
    await mountField({ inputInPopup: true, comboboxLabel: true, trigger: { id: 'fruit-trigger' } });
    expect(byTestId('field-label')).toHaveAttribute('for', 'fruit-trigger');
    expect(trigger().getAttribute('aria-labelledby')).toContain(byTestId('combobox-label')!.id);
    await userEvent.click(byTestId('combobox-label')!);
    expect(document.activeElement).toBe(trigger());
    await settle();
    expect(popup()).toBe(null);
  });

  test('the input in the popup has no ARIA attributes of the validation', async () => {
    await mountField({
      inputInPopup: true,
      field: { name: 'fruit', invalid: true },
      root: { defaultOpen: true },
    });
    await opened();
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    expect(input()).not.toHaveAttribute('aria-invalid');
    expect(input()).not.toHaveAttribute('aria-describedby');
  });

  test('with no label, the input has no `aria-labelledby`; the description names it in `aria-describedby`', async () => {
    await mountField({ fieldLabel: false });
    expect(input()).not.toHaveAttribute('aria-labelledby');
    expect(input().getAttribute('aria-describedby')).toContain(byTestId('description')!.id);
  });

  test('Combobox.Label follows a new id of the trigger', async () => {
    const triggerProps = reactive<Props>({ id: 'first' });
    await mountField({ inputInPopup: true, comboboxLabel: true, trigger: triggerProps });
    const label = byTestId('combobox-label')!;
    expect(trigger().getAttribute('aria-labelledby')).toContain(label.id);
    triggerProps.id = 'second';
    await nextTick();
    expect(trigger()).toHaveAttribute('id', 'second');
    expect(trigger().getAttribute('aria-labelledby')).toContain(label.id);
  });
});

describe('the state of the field', () => {
  test('`data-dirty` goes when a multiple value returns to its first value, and when an equal object comes back', async () => {
    await mountField({ root: { multiple: true, defaultValue: ['Apple'] } });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Banana'));
    await waitFor(() => expect(byTestId('field')).toHaveAttribute('data-dirty'));
    await userEvent.click(item('Banana'));
    await waitFor(() => expect(byTestId('field')).not.toHaveAttribute('data-dirty'));
  });

  test('an object value with the same contents is no change with `isItemEqualToValue`; the same values in another order are a change', async () => {
    const items = [
      { id: 1, label: 'Apple' },
      { id: 2, label: 'Banana' },
    ];
    const first = await mountField({
      items,
      root: {
        multiple: true,
        defaultValue: [{ id: 1, label: 'Apple' }],
        isItemEqualToValue: (a: { id: number }, b: { id: number }) => a.id === b.id,
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await waitFor(() => expect(byTestId('field')).toHaveAttribute('data-dirty'));
    await userEvent.click(item('Apple'));
    await waitFor(() => expect(byTestId('field')).not.toHaveAttribute('data-dirty'));
    first.unmount();
    await mountField({ root: { multiple: true, defaultValue: ['Apple', 'Banana'] } });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await userEvent.click(item('Apple'));
    await waitFor(() => expect(byTestId('field')).toHaveAttribute('data-dirty'));
  });

  test('`data-filled` shows with a value, from the mount or after a pick', async () => {
    const first = await mountField({ root: { defaultValue: 'Apple' } });
    expect(byTestId('field')).toHaveAttribute('data-filled');
    first.unmount();
    await mountField({});
    expect(byTestId('field')).not.toHaveAttribute('data-filled');
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await waitFor(() => expect(byTestId('field')).toHaveAttribute('data-filled'));
  });
});

describe('the validation', () => {
  test('`validate` gets the raw value, also with `itemToStringValue`, at each mode', async () => {
    for (const mode of ['change', 'blur', 'submit'] as const) {
      const values: unknown[] = [];
      const items = [
        { id: 1, label: 'Apple' },
        { id: 2, label: 'Banana' },
      ];
      const { unmount } = await mountField({
        items,
        field: {
          name: 'fruit',
          validationMode: mode,
          validate: (value: unknown) => {
            values.push(value);
            return 'error';
          },
        },
        root: { itemToStringValue: (value: { id: number }) => String(value.id) },
      });
      await userEvent.click(input());
      await opened();
      await userEvent.click(item('Banana'));
      await closed();
      if (mode === 'change') expect(values.at(-1)).toEqual(items[1]);
      if (mode === 'blur') {
        expect(values).toEqual([]);
        await userEvent.click(byTestId('outside')!);
        await waitFor(() => expect(values.at(-1)).toEqual(items[1]));
      }
      if (mode === 'submit') {
        expect(values).toEqual([]);
        await userEvent.click(byTestId('submit')!);
        await waitFor(() => expect(values.at(-1)).toEqual(items[1]));
      }
      await waitFor(() => expect(byTestId('error')).toHaveTextContent('error'));
      unmount();
    }
  });

  test('a blur of the popup with the input in it validates the field', async () => {
    const values: unknown[] = [];
    await mountField({
      inputInPopup: true,
      field: {
        validationMode: 'blur',
        validate: (value: unknown) => {
          values.push(value);
          return null;
        },
      },
      root: { defaultValue: 'Apple' },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.click(byTestId('outside')!);
    await closed();
    await waitFor(() => expect(values).toContain('Apple'));
  });
});

describe('`isItemEqualToValue`', () => {
  const items = [
    { id: 1, label: 'Apple' },
    { id: 2, label: 'Banana' },
  ];

  test('selects and deselects object values that it matches, and gets the item first', async () => {
    const calls: unknown[][] = [];
    const root = reactive<Props>({
      multiple: true,
      defaultValue: [{ id: 1, label: 'Apple' }],
      isItemEqualToValue: (a: { id: number }, b: { id: number }) => {
        calls.push([a, b]);
        return a.id === b.id;
      },
    });
    await mountField({ items, root });
    await userEvent.click(input());
    await opened();
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    expect(calls.some(([first]) => first === items[0])).toBe(true);
    await userEvent.click(item('Apple'));
    await waitFor(() => expect(item('Apple')).toHaveAttribute('aria-selected', 'false'));
  });

  test('gets no `null` or `undefined` at a clear or while the items load', async () => {
    const calls: unknown[][] = [];
    const loaded = reactive<unknown[]>([]);
    await mountField({
      items: loaded,
      root: {
        defaultValue: { id: 1, label: 'Apple' },
        itemToStringLabel: (value: { label: string }) => value.label,
        isItemEqualToValue: (a: { id: number }, b: { id: number }) => {
          calls.push([a, b]);
          return a.id === b.id;
        },
      },
    });
    await userEvent.click(input());
    loaded.push(...items);
    await opened();
    await userEvent.clear(input());
    await settle();
    expect(calls.flat().some((each) => each == null)).toBe(false);
  });

  test('a controlled value with the input in the popup keeps the items after a pick, while they load', async () => {
    const loaded = reactive<unknown[]>([]);
    const root = reactive<Props>({
      modelValue: null,
      isItemEqualToValue: (a: { id: number }, b: { id: number }) => a.id === b.id,
      itemToStringLabel: (value: { label: string }) => value.label,
    });
    root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
    await mountField({ inputInPopup: true, items: loaded, root });
    await userEvent.click(trigger());
    loaded.push(...items);
    await opened();
    await userEvent.click(item('Banana'));
    await closed();
    await userEvent.click(trigger());
    await opened();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(item('Banana')).toHaveAttribute('aria-selected', 'true');
  });
});
