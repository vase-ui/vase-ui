import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ComboboxInForm from '../../test/fixtures/ComboboxInForm.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const form = () => byTestId('form') as HTMLFormElement;
const entries = () => [...new FormData(form()).entries()];
const textInput = () => form().querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;

async function mountForm(props: Props = {}) {
  const result = mount(ComboboxInForm, props);
  await nextTick();
  return result;
}

describe('the form data', () => {
  test('a single value is one hidden input with the name; no value gives an empty text', async () => {
    const root = reactive<Props>({ name: 'fruit', modelValue: null });
    await mountForm({ root });
    expect(entries()).toEqual([['fruit', '']]);
    root.modelValue = 'Banana';
    await nextTick();
    expect(entries()).toEqual([['fruit', 'Banana']]);
    const hidden = form().querySelector('input[type="hidden"][name="fruit"]')!;
    expect(hidden.parentElement).toBe(textInput().parentElement);
  });

  test('a multiple value is one hidden input for each value', async () => {
    await mountForm({ root: { name: 'fruits', multiple: true, defaultValue: ['Apple', 'Cherry'] } });
    expect(entries()).toEqual([
      ['fruits', 'Apple'],
      ['fruits', 'Cherry'],
    ]);
  });

  test('the text form of an object value is its `value`, or `itemToStringValue`', async () => {
    await mountForm({ root: { name: 'a', defaultValue: { value: 'x', label: 'X' } } });
    expect(entries()).toEqual([['a', 'x']]);
  });

  test('a value with a line break keeps it', async () => {
    await mountForm({ root: { name: 'a', defaultValue: 'one\ntwo' } });
    expect(entries()).toEqual([['a', 'one\ntwo']]);
  });

  test('a disabled root gives the form no value; a disabled fieldset disables it', async () => {
    const first = await mountForm({ root: { name: 'a', defaultValue: 'Apple', disabled: true } });
    expect(entries()).toEqual([]);
    first.unmount();
    await mountForm({ root: { name: 'a', defaultValue: 'Apple' }, disabledFieldset: true });
    await waitFor(() => expect(byTestId('input')).toBeDisabled());
    expect(entries()).toEqual([]);
  });

  test('the text input with no work is `type="hidden"`; it has the id of the control', async () => {
    await mountForm();
    expect(textInput()).toHaveAttribute('type', 'hidden');
    expect(textInput().id).toBe(`${byTestId('input').id}-hidden-input`);
    expect(textInput()).not.toHaveAttribute('name');
  });
});

describe('the constraint validation', () => {
  test('a required root with no value blocks the submit and gives the focus to the control', async () => {
    let submits = 0;
    await mountForm({ root: { required: true }, onSubmit: () => (submits += 1) });
    await userEvent.click(byTestId('submit'));
    expect(submits).toBe(0);
    expect(document.activeElement).toBe(byTestId('input'));
    expect(byTestId('input')).toHaveAttribute('aria-required', 'true');
  });

  test('a read-only, required root with no value submits', async () => {
    let submits = 0;
    await mountForm({ root: { required: true, readonly: true }, onSubmit: () => (submits += 1) });
    await userEvent.click(byTestId('submit'));
    expect(submits).toBe(1);
  });

  test('a multiple root is required only while no value is selected', async () => {
    await mountForm({ root: { required: true, multiple: true, defaultValue: ['Apple'] } });
    expect(textInput()).not.toBeRequired();
  });
});

describe('the reset', () => {
  test('puts back the default value and text, and emits only the update events', async () => {
    const log: string[] = [];
    await mountForm({
      root: {
        name: 'a',
        defaultValue: 'Apple',
        onValueChange: () => log.push('valueChange'),
        onInputValueChange: () => log.push('inputValueChange'),
        'onUpdate:modelValue': (value: string) => log.push(`update:modelValue ${value}`),
        'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
      },
    });
    await userEvent.click(byTestId('input'));
    await userEvent.click(byTestId('item-Cherry'));
    log.length = 0;
    await userEvent.click(byTestId('reset'));
    await settle();
    expect(log).toEqual(['update:modelValue Apple', 'update:inputValue Apple']);
    expect(entries()).toEqual([['a', 'Apple']]);
    expect((byTestId('input') as HTMLInputElement).value).toBe('Apple');
  });
});

describe('the autofill', () => {
  test('an `input` event on the text input selects the item with that text, with no regard to case', async () => {
    const values: unknown[] = [];
    await mountForm({
      root: { name: 'a', autocomplete: 'fruit', 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    expect(textInput()).toHaveAttribute('type', 'text');
    expect(textInput()).toHaveAttribute('autocomplete', 'fruit');
    textInput().value = 'banana';
    textInput().dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(values).toEqual(['Banana']);
  });
});

describe('the field', () => {
  test('the control is the control of the field; a required root is invalid after a pick, a clear and a blur', async () => {
    await mountForm({ root: { required: true }, field: { name: 'fruit', validationMode: 'blur' } });
    const input = byTestId('input');
    await userEvent.click(input);
    await userEvent.click(byTestId('item-Apple'));
    await waitFor(() => expect(document.querySelector('[data-testid="popup"]')).toBe(null));
    await userEvent.keyboard('{Escape}');
    document.getElementById('outside')!.focus();
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(entries()).toEqual([['fruit', '']]);
  });

  test('BUG-1425: a required trigger with no value is invalid after the focus leaves it, and not dirty', async () => {
    await mountForm({
      inputInPopup: true,
      root: { required: true },
      field: { validationMode: 'blur', 'data-testid': 'field' },
    });
    const trigger = byTestId('trigger');
    trigger.focus();
    document.getElementById('outside')!.focus();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-invalid', 'true'));
    expect(byTestId('field')).toHaveAttribute('data-touched');
    expect(byTestId('field')).not.toHaveAttribute('data-dirty');
  });

});
