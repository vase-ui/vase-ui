import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { NumberFieldRootChangeEventDetails } from '@vase-ui/vue/number-field';
import { dataAttributes, leave } from '../../test/field';
import NumberFieldInField from '../../test/fixtures/NumberFieldInField.vue';
import NumberFieldInFieldset from '../../test/fixtures/NumberFieldInFieldset.vue';
import NumberFields from '../../test/fixtures/NumberFields.vue';
import { mount, settle, submitsPrevented, typeAtEnd } from '../../test/render';

type Attrs = Record<string, unknown>;

function record(log: string[], attrs: Attrs = {}) {
  return reactive<Attrs>({
    onValueChange: (value: number | null, details: NumberFieldRootChangeEventDetails) =>
      log.push(`change ${value} ${details.reason}`),
    'onUpdate:modelValue': (value: number | null) => log.push(`update ${value}`),
    onValueCommitted: (value: number | null, details: { reason: string }) =>
      log.push(`commit ${value} ${details.reason}`),
    ...attrs,
  });
}

async function mountField(props: Attrs = {}) {
  const { root } = mount(NumberFields, props);
  await nextTick();
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  return {
    root,
    form: find<HTMLFormElement>('#form'),
    other: find<HTMLFormElement>('#other'),
    field: find<HTMLElement>('#form > div'),
    input: find<HTMLInputElement>('#amount'),
    hidden: find<HTMLInputElement>('[type=number]'),
    increment: find<HTMLButtonElement>('[aria-label=Increase]'),
  };
}

async function mountInField(props: Attrs = {}) {
  const { root } = mount(NumberFieldInField, props);
  await nextTick();
  return {
    root,
    form: root.querySelector('form')!,
    field: root.querySelector<HTMLElement>('form > div')!,
    numberField: root.querySelector<HTMLElement>('form > div > div')!,
    input: root.querySelector<HTMLInputElement>('[role=spinbutton]')!,
    hidden: root.querySelector<HTMLInputElement>('[type=number]')!,
    label: root.querySelector('label')!,
  };
}

/** Writes the hidden input as a script or an autofill of the browser does. */
function fill(hidden: HTMLInputElement, text: string) {
  hidden.value = text;
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('the native form', () => {
  test('the form data has the number of the hidden input, and no entry for the text input', async () => {
    const root = reactive<Attrs>({ name: 'amount', defaultValue: 1234.5 });
    const { form, input } = await mountField({ root });
    expect(input.value).toBe('1,234.5');
    expect([...new FormData(form)]).toEqual([['amount', '1234.5']]);
    root.readonly = true;
    await nextTick();
    expect([...new FormData(form)]).toEqual([['amount', '1234.5']]);
    root.disabled = true;
    await nextTick();
    expect([...new FormData(form)]).toEqual([]);
  });

  test('the form prop gives both inputs to the form that it names; a reset of that form resets the field, and a reset of the other one does not', async () => {
    const log: string[] = [];
    const root = record(log, { name: 'amount', defaultValue: 1 });
    const { form, other, input, hidden } = await mountField({ root });
    root.form = 'other';
    await nextTick();
    expect(input.form).toBe(other);
    expect(hidden.form).toBe(other);
    expect([...new FormData(other)]).toEqual([['amount', '1']]);
    await typeAtEnd(input, '2');
    form.reset();
    await settle();
    expect(input.value).toBe('12');
    other.reset();
    await settle();
    expect(input.value).toBe('1');
    expect(log).toEqual(['change 12 input-change', 'update 12', 'update 1']);
  });

  test('a fill of the hidden input gives valueChange and valueCommitted with none, in the range', async () => {
    const log: string[] = [];
    const root = record(log, { max: 10 });
    const { input, hidden } = await mountField({ root });
    fill(hidden, '7');
    await settle();
    expect(input.value).toBe('7');
    fill(hidden, '70');
    await settle();
    expect(hidden.value).toBe('10');
    expect(log).toEqual([
      'change 7 none',
      'update 7',
      'commit 7 none',
      'change 10 none',
      'update 10',
      'commit 10 none',
    ]);
  });

  test('a fill of a disabled or read-only field, and a cancelled fill, change nothing', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 1, readonly: true });
    const { hidden } = await mountField({ root });
    fill(hidden, '7');
    await settle();
    expect(hidden.value).toBe('1');
    root.readonly = false;
    root.onValueChange = (_value: number | null, details: NumberFieldRootChangeEventDetails) =>
      details.cancel();
    await nextTick();
    fill(hidden, '8');
    await settle();
    expect(hidden.value).toBe('1');
    expect(log).toEqual([]);
  });

  test('a native reset gives the default value, or the model of the mount, and emits only update:modelValue', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 5 });
    const { form, input } = await mountField({ root });
    await typeAtEnd(input, '0');
    input.blur();
    await settle();
    log.length = 0;
    form.reset();
    await settle();
    expect(input.value).toBe('5');
    expect(log).toEqual(['update 5']);

    const controlled = record(log, { modelValue: 3 });
    controlled['onUpdate:modelValue'] = (value: number | null) => {
      log.push(`update ${value}`);
      controlled.modelValue = value;
    };
    const second = await mountField({ root: controlled });
    controlled.modelValue = 9;
    await nextTick();
    log.length = 0;
    second.form.reset();
    await settle();
    expect(second.input.value).toBe('3');
    expect(log).toEqual(['update 3']);
  });

  test('a reset with no change of the value emits nothing, and the text shows the format', async () => {
    const log: string[] = [];
    const { form, input } = await mountField({ root: record(log, { defaultValue: 5 }) });
    input.focus();
    input.select();
    await userEvent.keyboard('5.0');
    form.reset();
    await settle();
    expect(input.value).toBe('5');
    expect(log).toEqual([]);
  });

  test('a reset ends the edit, so the blur after it commits nothing', async () => {
    const log: string[] = [];
    const { form, input } = await mountField({ root: record(log, { defaultValue: 5 }) });
    await typeAtEnd(input, '0');
    await userEvent.keyboard('{ArrowUp}2');
    form.reset();
    await settle();
    input.blur();
    await settle();
    expect(log.filter((line) => line.startsWith('commit'))).toEqual(['commit 51 keyboard']);
  });

  test('a reset that a listener prevented changes nothing', async () => {
    const { form, input } = await mountField({ root: { defaultValue: 5 } });
    await typeAtEnd(input, '0');
    form.addEventListener('reset', (event) => event.preventDefault());
    form.reset();
    await settle();
    expect(input.value).toBe('50');
  });

  test('a required empty field fails the submit, and the focus that the browser gives the hidden input goes to the text input', async () => {
    const { form, input, hidden } = await mountField({ root: { required: true } });
    // The text input has text, so the browser finds the hidden input invalid first.
    await typeAtEnd(input, '-');
    input.blur();
    expect(hidden.validity.valueMissing).toBe(true);
    form.requestSubmit();
    await settle();
    expect(submitsPrevented).toEqual([]);
    expect(document.activeElement).toBe(input);
  });

  test('with min and step, the form refuses a number off the grid; with no step it accepts each number', async () => {
    const root = reactive<Attrs>({ min: 0, step: 1, defaultValue: 1.5 });
    const { hidden } = await mountField({ root });
    expect(hidden.validity.stepMismatch).toBe(true);
    root.step = undefined;
    await nextTick();
    expect(hidden.validity.stepMismatch).toBe(false);
  });
});

describe('Enter', () => {
  test('submits a form that has no submit button, as Enter in one text input does', async () => {
    const { input } = await mountField({ root: { defaultValue: 1 } });
    input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([false]);
  });

  test('with a submit button, the browser clicks it one time', async () => {
    const { input } = await mountField({ root: { defaultValue: 1 }, submitButton: true });
    input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([false]);
  });

  test('with an image button, the browser clicks it one time', async () => {
    const { form, input } = await mountField({ root: { defaultValue: 1 } });
    const image = form.appendChild(document.createElement('input'));
    image.type = 'image';
    input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([false]);
  });

  test('does not submit when a listener of the input or of an ancestor prevents the key', async () => {
    const prevent = (event: KeyboardEvent) => event.key === 'Enter' && event.preventDefault();
    const { input } = await mountField({
      root: { defaultValue: 1 },
      input: { onKeydown: prevent },
    });
    input.focus();
    await userEvent.keyboard('{Enter}');
    const second = await mountField({ root: { defaultValue: 1 } });
    second.form.addEventListener('keydown', prevent);
    second.input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([]);
  });

  test('does not submit when another field of the form blocks the implicit submission', async () => {
    const { form, input } = await mountField({ root: { defaultValue: 1 } });
    form.append(document.createElement('input'));
    input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submitsPrevented).toEqual([]);
  });
});

describe('Field and Form', () => {
  test('the label names the text input; the description describes it; the field name wins over the prop', async () => {
    const { input, hidden, label } = await mountInField({
      field: { name: 'price' },
      root: { name: 'amount' },
    });
    expect(label).toHaveAttribute('for', input.id);
    expect(input).toHaveAttribute('aria-describedby', 'description');
    expect(hidden).toHaveAttribute('name', 'price');
    await userEvent.click(label);
    expect(document.activeElement).toBe(input);
  });

  test('the field validates the number; an invalid field sets aria-invalid on the input and data-invalid on the parts', async () => {
    const validated: unknown[] = [];
    const field = {
      validationMode: 'blur',
      validate: (value: unknown) => {
        validated.push(value);
        return value === 13 ? 'Not 13.' : null;
      },
    };
    const { input, numberField } = await mountInField({ field, root: { defaultValue: 12 } });
    expect(dataAttributes(numberField)).toEqual(['data-filled']);
    await typeAtEnd(input, '{Backspace}3');
    await leave(input);
    expect(validated).toEqual([13]);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(dataAttributes(numberField)).toEqual([
      'data-dirty',
      'data-filled',
      'data-invalid',
      'data-touched',
    ]);
    expect(dataAttributes(input)).toEqual(['data-dirty', 'data-filled', 'data-touched']);
  });

  test('an edit removes the error that the form gives the field', async () => {
    const form = reactive<Attrs>({ errors: { amount: 'Taken.' } });
    form['onUpdate:errors'] = (errors: unknown) => (form.errors = errors);
    const { input } = await mountInField({
      form,
      field: { name: 'amount' },
      root: { defaultValue: 1 },
    });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await typeAtEnd(input, '2');
    await settle();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  test('a disabled field disables each part', async () => {
    const { input, hidden, numberField, root } = await mountInField({ field: { disabled: true } });
    expect(input.disabled && hidden.disabled).toBe(true);
    expect(numberField).toHaveAttribute('data-disabled');
    for (const button of root.querySelectorAll('button[aria-label]')) {
      expect(button).toBeDisabled();
    }
  });

  test('a Form gives the number at its submit, and focuses the input of an invalid field', async () => {
    const submits: unknown[] = [];
    const { form, input } = await mountInField({
      form: { onSubmit: (_event: Event, values: unknown) => submits.push(values) },
      field: { name: 'amount' },
      root: { required: true },
    });
    form.requestSubmit();
    await settle();
    expect(document.activeElement).toBe(input);
    await typeAtEnd(input, '4');
    form.requestSubmit();
    await settle();
    expect(submits).toEqual([{ amount: 4 }]);
  });

  test('VUE-21: a reset of the form removes the error and the value of the field', async () => {
    const { form, input, numberField } = await mountInField({
      field: { invalid: false, validationMode: 'change', validate: () => 'Wrong.' },
      root: { defaultValue: 1 },
    });
    await typeAtEnd(input, '2');
    await settle();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    form.reset();
    await settle();
    expect(input.value).toBe('1');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(dataAttributes(numberField)).toEqual(['data-filled']);
  });
});

describe('VUE-112: a disabled fieldset', () => {
  test.each([
    { kind: 'a native fieldset', native: true },
    { kind: 'a Fieldset.Root with another element', native: false },
  ])('$kind disables each part, and the buttons change no value', async ({ native }) => {
    const scene = reactive({ native, disabled: true });
    const { root } = mount(NumberFieldInFieldset, { scene });
    await settle();
    const input = root.querySelector<HTMLInputElement>('[role=spinbutton]')!;
    const increment = root.querySelector<HTMLButtonElement>('[aria-label=Increase]')!;
    expect(root.querySelector('[data-disabled]')).not.toBeNull();
    expect(increment).toBeDisabled();
    increment.click();
    await settle();
    expect(input.value).toBe('5');
    if (native) {
      expect(input.matches(':disabled')).toBe(true);
      // A disabled control has no validity: its field, outside the fieldset, is not invalid.
      expect(input).not.toHaveAttribute('aria-invalid');
    }
    scene.disabled = false;
    await settle();
    expect(increment).not.toBeDisabled();
    increment.click();
    await settle();
    expect(input.value).toBe('6');
  });
});
