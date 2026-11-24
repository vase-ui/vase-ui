import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ComboboxInForm from '../../test/fixtures/ComboboxInForm.vue';
import ComboboxTextarea from '../../test/fixtures/ComboboxTextarea.vue';
import { mount, settle, submitsPrevented } from '../../test/render';
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
    await mountForm({
      root: { name: 'fruits', multiple: true, defaultValue: ['Apple', 'Cherry'] },
    });
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
    await mountForm({ root: { required: true } });
    await userEvent.click(byTestId('submit'));
    expect(submitsPrevented).toEqual([]);
    expect(document.activeElement).toBe(byTestId('input'));
    expect(byTestId('input')).toHaveAttribute('aria-required', 'true');
  });

  test('a read-only, required root with no value submits', async () => {
    await mountForm({ root: { required: true, readonly: true } });
    await userEvent.click(byTestId('submit'));
    await waitFor(() => expect(submitsPrevented).toEqual([false]));
  });

  test('Enter on a highlighted item of a read-only root submits no form', async () => {
    await mountForm({ root: { readonly: true } });
    await userEvent.click(byTestId('input'));
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(byTestId('item-Apple')).toHaveAttribute('data-highlighted'));
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([]);
  });

  test('a multiple root is required only while no value is selected', async () => {
    await mountForm({ root: { required: true, multiple: true, defaultValue: ['Apple'] } });
    expect(textInput()).not.toBeRequired();
  });
});

describe('the field', () => {
  test.each([
    { control: 'input', inputInPopup: false },
    { control: 'trigger', inputInPopup: true },
  ])(
    'aria-describedby of the developer comes before the ids of the field, on the $control',
    async ({ control, inputInPopup }) => {
      await mountForm({
        field: { invalid: true },
        inputInPopup,
        [control]: { 'aria-describedby': 'hint' },
      });
      await waitFor(() => expect(byTestId('error')).not.toBe(null));
      expect(byTestId(control)).toHaveAttribute('aria-describedby', `hint ${byTestId('error').id}`);
    },
  );
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

describe('the reset of a controlled root or of a changed default', () => {
  test('BUG-6206: a controlled root gets the value and the text of its mount, with the update events only, and its field is not dirty', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      name: 'a',
      modelValue: 'Apple',
      inputValue: 'Apple',
      onValueChange: () => log.push('valueChange'),
      onInputValueChange: () => log.push('inputValueChange'),
    });
    root['onUpdate:modelValue'] = (value: string) => {
      log.push(`update:modelValue ${value}`);
      root.modelValue = value;
    };
    root['onUpdate:inputValue'] = (text: string) => {
      log.push(`update:inputValue ${text}`);
      root.inputValue = text;
    };
    await mountForm({ root, field: { 'data-testid': 'field' } });
    await userEvent.click(byTestId('input'));
    await userEvent.click(byTestId('item-Cherry'));
    await waitFor(() => expect(entries()).toEqual([['a', 'Cherry']]));
    expect(byTestId('field')).toHaveAttribute('data-dirty');
    log.length = 0;
    form().reset();
    await settle();
    expect(log).toEqual(['update:modelValue Apple', 'update:inputValue Apple']);
    expect(entries()).toEqual([['a', 'Apple']]);
    expect((byTestId('input') as HTMLInputElement).value).toBe('Apple');
    expect(byTestId('field')).not.toHaveAttribute('data-dirty');
  });

  test.each([
    { name: 'keeps', keeps: true, shown: 'Cherry' },
    { name: 'resets', keeps: false, shown: 'Apple' },
  ])(
    'the text is the label of the value after the reset, with a controlled value that the parent $name',
    async ({ keeps, shown }) => {
      const log: string[] = [];
      let keeping = false;
      const root = reactive<Props>({
        name: 'a',
        modelValue: 'Apple',
        onValueChange: () => log.push('valueChange'),
        onInputValueChange: () => log.push('inputValueChange'),
        'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
      });
      root['onUpdate:modelValue'] = (value: string) => {
        if (!keeping) root.modelValue = value;
      };
      await mountForm({ root });
      await userEvent.click(byTestId('input'));
      await userEvent.click(byTestId('item-Cherry'));
      await waitFor(() => expect(entries()).toEqual([['a', 'Cherry']]));
      log.length = 0;
      keeping = keeps;
      form().reset();
      await settle();
      expect((byTestId('input') as HTMLInputElement).value).toBe(shown);
      expect(entries()).toEqual([['a', shown]]);
      expect(log).toEqual(keeps ? [] : [`update:inputValue ${shown}`]);
    },
  );

  test('an uncontrolled root gets the defaultValue of the reset, after a change of it', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      name: 'a',
      defaultValue: 'Apple',
      'onUpdate:modelValue': (value: string) => log.push(`update:modelValue ${value}`),
      'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
    });
    await mountForm({ root });
    root.defaultValue = 'Cherry';
    await nextTick();
    expect(entries()).toEqual([['a', 'Apple']]);
    form().reset();
    await settle();
    expect(log).toEqual(['update:modelValue Cherry', 'update:inputValue Cherry']);
    expect(entries()).toEqual([['a', 'Cherry']]);
    expect((byTestId('input') as HTMLInputElement).value).toBe('Cherry');
  });
});

describe('the reset of a textarea in the slot of the input', () => {
  const textarea = () => form().querySelector('textarea')!;

  test.each([
    { name: 'v-model:input-value', root: { inputValue: 'Ada' }, shown: 'Ada' },
    { name: 'defaultInputValue', root: { defaultInputValue: 'Lin' }, shown: 'Lin' },
    { name: 'the label of the value', root: { defaultValue: 'Apple' }, shown: 'Apple' },
  ])('a reset with no edit gives the text of $name, and emits nothing', async ({ root, shown }) => {
    const log: string[] = [];
    mount(ComboboxTextarea, {
      root: reactive<Props>({
        ...root,
        'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
        'onUpdate:modelValue': (value: string) => log.push(`update:modelValue ${value}`),
      }),
    });
    await nextTick();
    expect(textarea()).toHaveValue(shown);
    form().reset();
    await settle();
    expect(textarea()).toHaveValue(shown);
    expect(log).toEqual([]);
  });

  test('a reset whose text the parent refuses gives the text of v-model:input-value', async () => {
    const log: string[] = [];
    // This parent logs each update and writes none.
    const root = reactive<Props>({
      inputValue: 'Ada',
      'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
    });
    mount(ComboboxTextarea, { root });
    await nextTick();
    root.inputValue = 'Bob';
    await nextTick();
    expect(textarea()).toHaveValue('Bob');
    form().reset();
    await settle();
    expect(log).toEqual(['update:inputValue Ada']);
    expect(textarea()).toHaveValue('Bob');
  });

  test('a reset with no edit gives a textarea in the popup the text of v-model:input-value', async () => {
    const log: string[] = [];
    mount(ComboboxTextarea, {
      inputInPopup: true,
      root: {
        inputValue: 'Ada',
        'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${text}`),
      },
    });
    await userEvent.click(byTestId('trigger'));
    await waitFor(() => expect(form().querySelector('textarea')).not.toBe(null));
    expect(textarea()).toHaveValue('Ada');
    form().reset();
    await settle();
    expect(textarea()).toHaveValue('Ada');
    expect(log).toEqual([]);
  });
});

describe('the autofill', () => {
  test('an `input` event on the text input selects the item with that text, with no regard to case', async () => {
    const values: unknown[] = [];
    await mountForm({
      root: {
        name: 'a',
        autocomplete: 'fruit',
        'onUpdate:modelValue': (value: unknown) => values.push(value),
      },
    });
    expect(textInput()).toHaveAttribute('type', 'text');
    expect(textInput()).toHaveAttribute('autocomplete', 'fruit');
    textInput().value = 'banana';
    textInput().dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(values).toEqual(['Banana']);
  });
});

describe('the autofill of a multiple root', () => {
  test('changes no value', async () => {
    const values: unknown[] = [];
    await mountForm({
      root: {
        name: 'a',
        multiple: true,
        autocomplete: 'fruit',
        'onUpdate:modelValue': (value: unknown) => values.push(value),
      },
    });
    textInput().value = 'banana';
    textInput().dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(values).toEqual([]);
    expect(entries()).toEqual([]);
  });
});

describe('the field', () => {
  test('a focus that moves from the input into the popup leaves the field untouched', async () => {
    await mountForm({ button: true, field: { 'data-testid': 'field' } });
    await userEvent.click(byTestId('input'));
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('popup-button'));
    expect(byTestId('field')).not.toHaveAttribute('data-touched');
  });

  test('a focus that moves from the trigger into the popup leaves the field untouched', async () => {
    await mountForm({ inputInPopup: true, field: { 'data-testid': 'field' } });
    byTestId('trigger').focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('input')));
    expect(byTestId('field')).not.toHaveAttribute('data-touched');
  });

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

  test('a pick takes back the error of a required field', async () => {
    await mountForm({
      inputInPopup: true,
      root: { required: true },
      field: { validationMode: 'blur' },
    });
    const trigger = byTestId('trigger');
    trigger.focus();
    document.getElementById('outside')!.focus();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-invalid', 'true'));
    await userEvent.click(trigger);
    await userEvent.click(byTestId('item-Apple'));
    await waitFor(() => expect(trigger).not.toHaveAttribute('aria-invalid'));
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
