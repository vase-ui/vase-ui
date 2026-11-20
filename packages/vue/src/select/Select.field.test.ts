import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { leave } from '../../test/field';
import SelectInField from '../../test/fixtures/SelectInField.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Attrs = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const shown = (element: HTMLElement | null) => !!element?.checkVisibility();

async function mountField(props: Attrs = {}) {
  const { root } = mount(SelectInField, props);
  await nextTick();
  return {
    form: root.querySelector('form')!,
    field: root.querySelector<HTMLElement>('fieldset > div')!,
    text: root.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!,
    label: root.querySelector('label')!,
  };
}

/** Writes the text input as the autofill of a browser does. */
function fill(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function pick(value: string) {
  await userEvent.click(trigger());
  await waitFor(() => expect(shown(byTestId('popup'))).toBe(true));
  await userEvent.click(byTestId(`item-${value}`));
  await waitFor(() => expect(shown(byTestId('popup'))).toBe(false));
}

describe('the form inputs', () => {
  test('VUE-102: the form data has the value of a hidden input, with its line break; the text input has no name', async () => {
    const { form, text } = await mountField({ noField: true, root: { name: 'letter' } });
    expect([...new FormData(form)]).toEqual([['letter', '']]);
    await pick('b');
    expect([...new FormData(form)]).toEqual([['letter', 'b\nline']]);
    expect(text).not.toHaveAttribute('name');
    expect(text.value).toBe('bline');
    expect(text.id).toBe(`${trigger().id}-hidden-input`);
    expect(text.tabIndex).toBe(-1);
  });

  test('with multiple, one hidden input for each value; a disabled select gives no entry', async () => {
    const root = reactive<Attrs>({
      name: 'letter',
      multiple: true,
      defaultValue: ['a', 'b\nline'],
    });
    const { form, text } = await mountField({ noField: true, root });
    expect([...new FormData(form)]).toEqual([
      ['letter', 'a'],
      ['letter', 'b\nline'],
    ]);
    expect(text.value).toBe('');
    root.disabled = true;
    await nextTick();
    expect([...new FormData(form)]).toEqual([]);
  });

  test('the text input is type="hidden" with no field, no name, no autocomplete and no required', async () => {
    mount(SelectParts);
    await nextTick();
    const text = byTestId('root').querySelector('input[aria-hidden="true"]')!;
    expect(text).toHaveAttribute('type', 'hidden');
  });

  test('itemToStringValue gives the text of an object value', async () => {
    const { form } = await mountField({
      noField: true,
      root: {
        name: 'letter',
        defaultValue: { id: 7 },
        itemToStringValue: (v: { id: number }) => `#${v.id}`,
      },
    });
    expect([...new FormData(form)]).toEqual([['letter', '#7']]);
  });
});

describe('the validation', () => {
  test('a required select with no value blocks the submit, and the trigger gets the focus and its ring', async () => {
    const { form, text } = await mountField({ noField: true, root: { required: true } });
    let submits = 0;
    form.addEventListener('submit', () => (submits += 1));
    await userEvent.click(document.getElementById('submit-button')!);
    expect(submits).toBe(0);
    expect(text.validity.valueMissing).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    expect(trigger().matches(':focus-visible')).toBe(true);
  });

  test('with multiple, the text input is required only while nothing is selected', async () => {
    const { text } = await mountField({ noField: true, root: { required: true, multiple: true } });
    expect(text.required).toBe(true);
    await userEvent.click(trigger());
    await waitFor(() => expect(shown(byTestId('popup'))).toBe(true));
    await userEvent.click(byTestId('item-a'));
    await waitFor(() => expect(text.required).toBe(false));
  });

  test('VUE-115: with multiple, the field validates the empty array for a null model', async () => {
    const seen: unknown[] = [];
    await mountField({
      field: { validationMode: 'blur', validate: (value: unknown) => void seen.push(value) },
      root: { multiple: true, modelValue: null },
    });
    trigger().focus();
    await leave(trigger());
    await waitFor(() => expect(seen).toEqual([[]]));
  });

  test('BUG-1425: a required select with no value is invalid after the focus leaves it in blur mode', async () => {
    const { field } = await mountField({
      field: { validationMode: 'blur' },
      root: { required: true },
    });
    trigger().focus();
    await leave(trigger());
    await waitFor(() => expect(field).toHaveAttribute('data-invalid'));
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('the field', () => {
  test('a pick makes the field dirty and filled, and a leave makes it touched; the focus that goes into the popup is no leave', async () => {
    const { field } = await mountField({ root: { name: 'letter' } });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('item-a')));
    await settle();
    expect(field).not.toHaveAttribute('data-touched');
    await userEvent.click(byTestId('item-a'));
    await waitFor(() => expect(field).toHaveAttribute('data-dirty'));
    expect(field).toHaveAttribute('data-filled');
    expect(trigger()).toHaveAttribute('data-filled');
    await leave(trigger());
    expect(field).toHaveAttribute('data-touched');
  });

  test('a Tab out of the popup that a press opened makes the field touched', async () => {
    const { field } = await mountField();
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('popup')));
    await userEvent.keyboard('{ArrowDown}{Tab}');
    await waitFor(() => expect(shown(byTestId('popup'))).toBe(false));
    await waitFor(() => expect(field).toHaveAttribute('data-touched'));
  });

  test('Field.Label names the trigger, and a click on it opens the select', async () => {
    const { label } = await mountField();
    expect(label.htmlFor).toBe(trigger().id);
    expect(trigger()).toHaveAttribute('aria-labelledby', label.id);
    expect(trigger()).toHaveAttribute('aria-describedby', 'description');
    await userEvent.click(label);
    await waitFor(() => expect(shown(byTestId('popup'))).toBe(true));
    // A pointer open highlights no item. A key goes to the list, from the trigger or the popup.
    expect(byTestId('popup').querySelector('[data-highlighted]')).toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('item-a')));
  });

  test('a disabled field, a disabled fieldset and the root disable the trigger', async () => {
    const field = reactive<Attrs>({ disabled: true });
    const fieldset = reactive<Attrs>({});
    const root = reactive<Attrs>({});
    await mountField({ field, fieldset, root });
    expect(trigger()).toBeDisabled();
    field.disabled = false;
    fieldset.disabled = true;
    await settle();
    expect(trigger()).toBeDisabled();
    fieldset.disabled = undefined;
    root.disabled = true;
    await settle();
    expect(trigger()).toBeDisabled();
  });

  test('VUE-112: a disabled fieldset gives the form no value', async () => {
    const { form } = await mountField({
      noField: true,
      fieldset: { disabled: true },
      root: { name: 'l', defaultValue: 'a' },
    });
    await settle();
    expect(trigger()).toBeDisabled();
    expect([...new FormData(form)]).toEqual([]);
  });
});

describe('the fill', () => {
  test('selects the item whose form text, label or text is the text of the input, with no regard to case', async () => {
    const log: string[] = [];
    const { text } = await mountField({
      noField: true,
      root: {
        autocomplete: 'on',
        onValueChange: (v: string, d: { reason: string }) => log.push(`${v} ${d.reason}`),
      },
    });
    fill(text, 'A');
    await waitFor(() => expect(trigger()).toHaveTextContent('a'));
    expect(log).toEqual(['a none']);
    fill(text, 'zzz');
    await settle();
    expect(text.value).toBe('a');
  });

  test('a fill does nothing in a read-only select', async () => {
    const { text } = await mountField({
      noField: true,
      root: { autocomplete: 'on', readonly: true },
    });
    fill(text, 'a');
    await settle();
    expect(trigger()).toHaveTextContent('');
    expect(text.value).toBe('');
  });
});

describe('the reset', () => {
  test('BUG-6206: a native reset puts the first value back with update:modelValue only, also on a controlled select', async () => {
    const log: string[] = [];
    const root = reactive<Attrs>({
      defaultValue: 'a',
      onValueChange: () => log.push('change'),
      'onUpdate:modelValue': (v: string) => log.push(`update ${v}`),
    });
    const { form } = await mountField({ root });
    await pick('b');
    log.length = 0;
    form.reset();
    await waitFor(() => expect(log).toEqual(['update a']));
    expect(trigger()).toHaveTextContent('a');
  });

  test('VUE-21: a reset clears the error of the field', async () => {
    const { form, field } = await mountField({
      field: { validationMode: 'change' },
      root: { required: true, defaultValue: 'a' },
    });
    await pick('b');
    form.reset();
    await waitFor(() => expect(trigger()).toHaveTextContent('a'));
    expect(field).not.toHaveAttribute('data-invalid');
    expect(field).not.toHaveAttribute('data-dirty');
  });
});

describe('Select.Label', () => {
  test('a click gives the trigger the focus and opens nothing', async () => {
    mount(SelectParts, { label: {} });
    await nextTick();
    await userEvent.click(byTestId('label'));
    expect(document.activeElement).toBe(trigger());
    expect(byTestId('popup')).not.toBe(null);
    expect(shown(byTestId('popup'))).toBe(false);
  });
});
