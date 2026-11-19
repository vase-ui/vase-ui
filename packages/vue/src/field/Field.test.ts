import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { InputChangeEventDetails } from '@vase-ui/vue/input';
import { vModel } from '../../test/attrs';
import { dataAttributes, recordValidate, leave } from '../../test/field';
import ErrorInTransition from '../../test/fixtures/ErrorInTransition.vue';
import FieldElementIds from '../../test/fixtures/FieldElementIds.vue';
import FieldPartsReplaced from '../../test/fixtures/FieldPartsReplaced.vue';
import FieldSlots from '../../test/fixtures/FieldSlots.vue';
import FieldsInForm from '../../test/fixtures/FieldsInForm.vue';
import FieldWithInput from '../../test/fixtures/FieldWithInput.vue';
import KeptAliveField from '../../test/fixtures/KeptAliveField.vue';
import LabelAroundInput from '../../test/fixtures/LabelAroundInput.vue';
import PartOutsideRoot from '../../test/fixtures/PartOutsideRoot.vue';
import PartsBeforeControl from '../../test/fixtures/PartsBeforeControl.vue';
import RadioChoices from '../../test/fixtures/RadioChoices.vue';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount, mountError, settle, typeAtEnd } from '../../test/render';
import { screen } from '../../test/queries';
import { waitFor } from '../../test/waitFor';

/** Mounts a field with a label, an input, a description and one error, and waits one render. */
async function mountField(props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(FieldWithInput, props);
  await nextTick();
  return {
    root,
    exposed,
    field: root.firstElementChild!,
    label: root.querySelector('label')!,
    input: root.querySelector('input')!,
    description: root.querySelector('p')!,
    error: () => root.firstElementChild!.querySelector(':scope > div'),
  };
}

/** The state attributes of the root, the label, the description and the input. */
function stateOfParts(parts: Awaited<ReturnType<typeof mountField>>) {
  return [parts.field, parts.label, parts.description, parts.input].map(dataAttributes);
}

describe('the parts', () => {
  test('each part renders its element, and the attributes of the developer win', async () => {
    const { field, label, input, description, error } = await mountField({
      root: { class: 'Field', 'data-filled': 'never' },
      label: { id: 'name-label', for: 'other' },
      description: { id: 'name-description', class: 'Description' },
    });
    const shown = reactive({ description: true });
    const generated = await mountField({ description: { id: '' }, shown });
    expect(generated.description.id).not.toBe('');
    expect(generated.input).toHaveAttribute('aria-describedby', generated.description.id);
    shown.description = false;
    await nextTick();
    expect(generated.input).not.toHaveAttribute('aria-describedby');
    expect(field.tagName).toBe('DIV');
    expect(field).toHaveClass('Field');
    expect(field).toHaveAttribute('data-filled', 'never');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('id', 'name-label');
    expect(label).toHaveAttribute('for', 'other');
    expect(description.tagName).toBe('P');
    expect(description).toHaveAttribute('id', 'name-description');
    expect(input).toHaveAttribute('aria-describedby', 'name-description');
    expect(error()).toBeNull();
  });

  test('the slot of each part gets the state, and the slot of Field.Root the validity and errors', async () => {
    const { root } = mount(FieldSlots, { root: { validationMode: 'blur' } });
    await nextTick();
    const input = root.querySelector('input')!;
    input.focus();
    await leave(input);
    const rootSlot = JSON.parse(root.querySelector('output')!.textContent!);
    expect(rootSlot.validity).toMatchObject({ valueMissing: false, valid: true });
    expect(rootSlot.errors).toEqual([]);
    expect(rootSlot.state).toMatchObject({ touched: true, valid: true });
    expect(JSON.parse(root.querySelector('label')!.textContent!)).toEqual(rootSlot.state);
    expect(JSON.parse(root.querySelector('p')!.textContent!)).toEqual(rootSlot.state);
  });

  test('the slot of Field.Root gets the value and the first value of the control', async () => {
    const { root } = mount(FieldSlots);
    await nextTick();
    const values = () => JSON.parse(root.querySelector('.value')!.textContent!);
    expect(values()).toEqual({ value: '', initialValue: '' });
    await typeAtEnd(root.querySelector('input')!, 'ab');
    await nextTick();
    expect(values()).toEqual({ value: 'ab', initialValue: '' });
  });

  test('validate() of the template ref validates at once, and each part has element', async () => {
    const { exposed, field, input, error } = await mountField({ input: { required: true } });
    expect(exposed.field.element).toBe(field);
    expect(field).not.toHaveAttribute('data-invalid');
    exposed.field.validate();
    await nextTick();
    expect(field).toHaveAttribute('data-invalid');
    expect(error()).toHaveTextContent(input.validationMessage);
  });

  test('the element slot of each part renders the element of the developer', async () => {
    const { root } = mount(FieldPartsReplaced, { root: { invalid: true } });
    await nextTick();
    const input = root.querySelector('input')!;
    expect(root.firstElementChild!.tagName).toBe('SECTION');
    // A label that is not a `<label>` names the control by `aria-labelledby`.
    const label = root.querySelector('span')!;
    expect(label).not.toHaveAttribute('for');
    expect(input).toHaveAttribute('aria-labelledby', label.id);
    expect(root.querySelector('section')).toHaveAttribute('data-invalid');
    const description = root.querySelector('small')!;
    const error = root.querySelector('strong')!;
    expect(input).toHaveAttribute('aria-describedby', `${description.id} ${error.id}`);
  });
});

describe('the state', () => {
  test('touched: the focus left the control; v-model:touched follows, and a prop controls it', async () => {
    const onTouched = vi.fn();
    const parts = await mountField({ root: { 'onUpdate:touched': onTouched } });
    parts.input.focus();
    await leave(parts.input);
    expect(stateOfParts(parts).every((names) => names.includes('data-touched'))).toBe(true);
    expect(onTouched).toHaveBeenCalledWith(true);

    const controlled = await mountField({ root: { touched: false } });
    controlled.input.focus();
    await leave(controlled.input);
    expect(controlled.field).not.toHaveAttribute('data-touched');
  });

  test('dirty: the value differs from the first value; a refused or cancelled edit does not count', async () => {
    const onDirty = vi.fn();
    const input = vModel('a');
    const parts = await mountField({ root: { 'onUpdate:dirty': onDirty }, input });
    await typeAtEnd(parts.input, 'b');
    expect(stateOfParts(parts).every((names) => names.includes('data-dirty'))).toBe(true);
    expect(onDirty).toHaveBeenLastCalledWith(true);
    input.modelValue = 'a';
    await nextTick();
    expect(parts.field).not.toHaveAttribute('data-dirty');
    expect(onDirty).toHaveBeenLastCalledWith(false);

    const refused = await mountField({ input: { modelValue: 'a' } });
    await typeAtEnd(refused.input, 'b');
    await nextTick();
    expect(refused.field).not.toHaveAttribute('data-dirty');
    const cancelled = await mountField({
      input: {
        onValueChange: (_value: string, details: InputChangeEventDetails) => details.cancel(),
      },
    });
    await typeAtEnd(cancelled.input, 'b');
    await nextTick();
    expect(cancelled.field).not.toHaveAttribute('data-dirty');

    const controlled = await mountField({ root: { dirty: false } });
    await typeAtEnd(controlled.input, 'b');
    expect(controlled.field).not.toHaveAttribute('data-dirty');
  });

  test('the first value stays when the control mounts again; an empty control is not filled', async () => {
    const input = reactive({ defaultValue: 'a' });
    const shown = reactive({ input: true });
    const { field } = await mountField({ input, shown });
    expect(dataAttributes(field)).toEqual(['data-filled']);
    shown.input = false;
    await nextTick();
    input.defaultValue = '';
    shown.input = true;
    await nextTick();
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-dirty']);
  });

  test('valid: invalid makes the field and each part invalid, and the control aria-invalid', async () => {
    const root = reactive({ invalid: true, validationMode: 'blur' as const });
    const parts = await mountField({ root });
    for (const part of [parts.field, parts.label, parts.description]) {
      expect(part).toHaveAttribute('data-invalid');
    }
    expect(parts.input).not.toHaveAttribute('data-invalid');
    expect(parts.input).toHaveAttribute('aria-invalid', 'true');
    root.invalid = false;
    await nextTick();
    expect(stateOfParts(parts).flat()).not.toContain('data-invalid');
    expect(parts.input).not.toHaveAttribute('aria-invalid');
    parts.input.focus();
    await leave(parts.input);
    expect(stateOfParts(parts).every((names) => names.includes('data-valid'))).toBe(true);
    expect(parts.input).not.toHaveAttribute('aria-invalid');
  });
});

describe('a disabled field', () => {
  test('disables the control, and has no validity', async () => {
    const root = reactive({ disabled: true, invalid: true, validationMode: 'change' as const });
    const parts = await mountField({ root, input: { disabled: false, required: true } });
    expect(parts.input.matches(':disabled')).toBe(true);
    expect(parts.input).not.toHaveAttribute('data-disabled');
    for (const part of [parts.field, parts.label, parts.description]) {
      expect(part).toHaveAttribute('data-disabled');
    }
    expect(stateOfParts(parts).flat()).not.toContain('data-invalid');
    expect(parts.input).not.toHaveAttribute('aria-invalid');
    expect(parts.error()).toBeNull();
  });

  test('a control that its own prop disables gives the field no validity', async () => {
    const { field, error } = await mountField({
      root: { invalid: true },
      input: { disabled: true },
    });
    expect(field).not.toHaveAttribute('data-invalid');
    expect(error()).toBeNull();
  });
});

describe('the label', () => {
  test('VUE-23: has an id that follows the prop, and names the control by the id of the control', async () => {
    const label = reactive({ id: '' });
    const input = reactive({ id: 'first' });
    const parts = await mountField({ label, input });
    expect(parts.label.id).not.toBe('');
    expect(parts.label).toHaveAttribute('for', 'first');
    label.id = 'label';
    input.id = 'second';
    await nextTick();
    await nextTick();
    expect(parts.label).toHaveAttribute('id', 'label');
    expect(parts.label).toHaveAttribute('for', 'second');
    input.id = '';
    await nextTick();
    await nextTick();
    expect(parts.label).toHaveAttribute('for', parts.input.id);
    await userEvent.click(parts.label);
    expect(parts.input).toHaveFocus();
  });

  test('a label that is not a <label> names the control by aria-labelledby, and a click on it moves the focus to the control', async () => {
    const { root } = mount(FieldPartsReplaced);
    await nextTick();
    const label = root.querySelector('span')!;
    const input = root.querySelector('input')!;
    expect(input).toHaveAttribute('aria-labelledby', label.id);
    await userEvent.click(label);
    expect(input).toHaveFocus();
  });

  test('VUE-118: the element slot gives the ids, and the label, the control and the description follow them', async () => {
    const { root } = mount(FieldElementIds);
    await nextTick();
    await nextTick();
    const input = root.querySelector('input')!;
    expect(root.querySelector('label')).toHaveAttribute('for', 'own-input');
    expect(input).toHaveAttribute('aria-labelledby', 'own-span');
    expect(input).toHaveAttribute('aria-describedby', 'own-description');
    await userEvent.click(root.querySelector('span')!);
    expect(input).toHaveFocus();
  });

  test('names a control that is inside it', async () => {
    mount(LabelAroundInput);
    await nextTick();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });
});

describe('a control that the focus leaves with no move of the user', () => {
  test('a focused control that Vue removes does not touch the field', async () => {
    const onTouched = vi.fn();
    const shown = reactive({ input: true });
    const parts = await mountField({ root: { 'onUpdate:touched': onTouched }, shown });
    parts.input.focus();
    shown.input = false;
    await settle();
    await settle();
    expect(parts.field).not.toHaveAttribute('data-touched');
    expect(onTouched).not.toHaveBeenCalled();
  });

  test('a focused radio that Vue removes from its group does not touch the field', async () => {
    const onTouched = vi.fn();
    const items = reactive([{ key: 'a' }, { key: 'b' }]);
    const { root } = mount(RadioChoices, { items, field: { 'onUpdate:touched': onTouched } });
    await nextTick();
    root.querySelector<HTMLInputElement>('#b')!.focus();
    items.pop();
    await settle();
    await settle();
    expect(root.querySelector('[role=radiogroup]')).not.toHaveAttribute('data-touched');
    expect(onTouched).not.toHaveBeenCalled();
  });

  test.each([
    { name: 'disabled', attrs: { disabled: true } },
    { name: 'hidden', attrs: { style: { display: 'none' } } },
  ])('a focused control that becomes $name does not touch the field', async ({ attrs }) => {
    const onTouched = vi.fn();
    const input = reactive<Record<string, unknown>>({});
    const parts = await mountField({ root: { 'onUpdate:touched': onTouched }, input });
    parts.input.focus();
    Object.assign(input, attrs);
    await settle();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();
    expect(parts.field).not.toHaveAttribute('data-touched');
    expect(onTouched).not.toHaveBeenCalled();
  });
});

describe('the descriptions and the errors', () => {
  test('aria-describedby has their ids in the sequence of their mount, and an error only while it shows', async () => {
    const root = reactive({ invalid: false });
    const { root: element } = mount(PartsBeforeControl, { root });
    await nextTick();
    const input = element.querySelector('input')!;
    expect(input).toHaveAttribute('aria-describedby', 'first last');
    root.invalid = true;
    await nextTick();
    expect(input).toHaveAttribute('aria-describedby', 'first error last');
    expect(input).toHaveAccessibleDescription(/^First\. +Last\.$/);
  });
});

describe('one validation', () => {
  test('the native check comes first, and a failure ends the validation', async () => {
    const validated: unknown[] = [];
    const { exposed, field, input, error } = await mountField({
      root: recordValidate(validated),
      input: { type: 'email', defaultValue: 'colm' },
    });
    exposed.field.validate();
    await nextTick();
    expect(validated).toEqual([]);
    expect(field).toHaveAttribute('data-invalid');
    expect(error()).toHaveTextContent(input.validationMessage);
  });

  test('validate gets the text, and its strings are the errors; an empty result is valid', async () => {
    const result = { value: undefined as unknown };
    const validated: unknown[] = [];
    const { exposed, field, input, error } = await mountField({
      root: {
        validate: (value: unknown) => {
          validated.push(value);
          return result.value;
        },
      },
      input: { defaultValue: 'Colm' },
      errors: [{}, { match: 'customError' }],
    });
    for (const passing of [undefined, null, '', [], ['']]) {
      result.value = passing;
      exposed.field.validate();
      await nextTick();
      expect(field).toHaveAttribute('data-valid');
    }
    result.value = ['Too short.', 'Too plain.'];
    exposed.field.validate();
    await nextTick();
    expect(validated.at(-1)).toBe('Colm');
    expect(field).toHaveAttribute('data-invalid');
    expect(input.validationMessage).toBe('Too short.\nToo plain.');
    expect(error()!.querySelectorAll('li')).toHaveLength(2);
    result.value = 'Too short.';
    exposed.field.validate();
    await nextTick();
    expect(error()).toHaveTextContent('Too short.');
    expect(error()!.querySelector('ul')).toBeNull();
  });

  test('a read-only control is not validated and has no validity', async () => {
    const validated: unknown[] = [];
    const input = reactive({ readonly: false, required: true });
    const { root, exposed, field } = await mountField({ root: recordValidate(validated), input });
    exposed.field.validate();
    await nextTick();
    expect(field).toHaveAttribute('data-invalid');
    input.readonly = true;
    await nextTick();
    expect(root.querySelector('input')).toHaveAttribute('readonly');
    expect(field).not.toHaveAttribute('data-invalid');
    exposed.field.validate();
    expect(validated).toEqual([]);
  });

  test('a message of validate goes on the element, with a line feed between two lines', async () => {
    const { exposed, input } = await mountField({
      root: { validate: (value: unknown) => (value === 'bad' ? 'One\r\ntwo' : null) },
      input: { defaultValue: 'bad' },
    });
    exposed.field.validate();
    expect(input.validationMessage).toBe('One\ntwo');
    expect(input.matches(':invalid')).toBe(true);
    await typeAtEnd(input, '!');
    exposed.field.validate();
    expect(input.validationMessage).toBe('');
  });
});

describe('when a field validates', () => {
  test('submit: an edit or a blur starts no validation', async () => {
    const validated: unknown[] = [];
    const { input } = await mountField({ root: recordValidate(validated) });
    await typeAtEnd(input, 'a');
    await leave(input);
    expect(validated).toEqual([]);
  });

  test('blur: at the blur, with the value after the blur listeners of the developer', async () => {
    const validated: unknown[] = [];
    const input = vModel('a');
    input.onBlur = () => (input.modelValue = String(input.modelValue).toUpperCase());
    const parts = await mountField({
      root: recordValidate(validated, { validationMode: 'blur' }),
      input,
    });
    await typeAtEnd(parts.input, 'b');
    await settle();
    expect(validated).toEqual([]);
    await leave(parts.input);
    // A second blur of a touched field changes no state of the field.
    await typeAtEnd(parts.input, 'c');
    await leave(parts.input);
    expect(validated).toEqual(['AB', 'ABC']);
  });

  test('change: at each edit and each change by the parent, not at the blur', async () => {
    const validated: unknown[] = [];
    const input = vModel('');
    const parts = await mountField({
      root: recordValidate(validated, { validationMode: 'change' }),
      input,
    });
    await typeAtEnd(parts.input, 'ab');
    await nextTick();
    input.modelValue = 'c';
    await nextTick();
    await nextTick();
    await leave(parts.input);
    expect(validated).toEqual(['a', 'ab', 'c']);
  });

  test('change: a change by the parent validates the value that the element shows', async () => {
    const input = vModel('a');
    input.required = true;
    const parts = await mountField({ root: { validationMode: 'change' }, input });
    input.modelValue = '';
    await waitFor(() => expect(parts.field.hasAttribute('data-invalid')).toBe(true));
  });

  test('a cancelled edit starts no validation and clears no error', async () => {
    const validated: unknown[] = [];
    const input = reactive({
      onValueChange: (_value: string, _details: InputChangeEventDetails) => {},
    });
    const parts = await mountField({
      root: {
        validationMode: 'change',
        validate: (value: unknown) => {
          validated.push(value);
          return 'Wrong.';
        },
      },
      input,
    });
    await typeAtEnd(parts.input, 'a');
    await nextTick();
    expect(parts.field).toHaveAttribute('data-invalid');
    input.onValueChange = (_value, details) => details.cancel();
    await typeAtEnd(parts.input, 'b');
    await nextTick();
    expect(validated).toEqual(['a']);
    expect(parts.field).toHaveAttribute('data-invalid');
  });
});

describe('the required rule', () => {
  test('an empty required control fails only after the field was dirty', async () => {
    const parts = await mountField({ root: { validationMode: 'blur' }, input: { required: true } });
    parts.input.focus();
    await leave(parts.input);
    expect(parts.field).toHaveAttribute('data-valid');
    await typeAtEnd(parts.input, 'a');
    await userEvent.keyboard('{Backspace}');
    await leave(parts.input);
    expect(parts.field).toHaveAttribute('data-invalid');
    expect(parts.error()).toHaveTextContent(parts.input.validationMessage);
  });

  test('each other native failure counts at once', async () => {
    const parts = await mountField({
      root: { validationMode: 'blur' },
      input: { type: 'email', defaultValue: 'colm' },
    });
    parts.input.focus();
    await leave(parts.input);
    expect(parts.field).toHaveAttribute('data-invalid');
  });
});

describe('edits while the field is invalid', () => {
  test('an edit makes the field valid, or shows valueMissing at once', async () => {
    const validated: unknown[] = [];
    const parts = await mountField({
      root: recordValidate(validated, { validationMode: 'blur' }),
      input: { pattern: '[a-z]+@[a-z]+', required: true, defaultValue: 'colm' },
      errors: [{ match: 'patternMismatch' }, { match: 'valueMissing' }],
    });
    parts.input.focus();
    await leave(parts.input);
    expect(parts.error()).toHaveTextContent(parts.input.validationMessage);
    parts.input.select();
    await userEvent.keyboard('{Backspace}');
    await nextTick();
    expect(parts.field).toHaveAttribute('data-invalid');
    expect(parts.error()).toHaveTextContent(parts.input.validationMessage);
    await typeAtEnd(parts.input, 'x');
    await nextTick();
    expect(parts.field).toHaveAttribute('data-valid');
    expect(parts.error()).toBeNull();
    expect(validated).toEqual([]);
  });

  test('an edit takes back the message of validate from the element', async () => {
    const parts = await mountField({ root: { validationMode: 'blur', validate: () => 'Taken.' } });
    parts.input.focus();
    await leave(parts.input);
    expect(parts.input.validationMessage).toBe('Taken.');
    await typeAtEnd(parts.input, 'x');
    await nextTick();
    expect(parts.field).toHaveAttribute('data-valid');
    expect(parts.input.matches(':invalid')).toBe(false);
  });
});

describe('debounce and async validation', () => {
  test('a change waits the debounce time, and the field validates one time with the last value', async () => {
    const validated: unknown[] = [];
    const shown = reactive({ input: true });
    const parts = await mountField({
      root: recordValidate(validated, { validationMode: 'change', validationDebounceTime: 300 }),
      shown,
    });
    await typeAtEnd(parts.input, 'abc');
    await waitFor(() => expect(validated).toEqual(['abc']));
    await typeAtEnd(parts.input, 'd');
    shown.input = false;
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(validated).toEqual(['abc']);
  });

  test('a native reset drops a validation that waits', async () => {
    const validated: unknown[] = [];
    const { root } = mount(FieldsInForm, {
      fields: [
        {
          root: recordValidate(validated, {
            validationMode: 'change',
            validationDebounceTime: 300,
          }),
        },
      ],
    });
    await nextTick();
    await typeAtEnd(root.querySelector('input')!, 'a');
    root.querySelector('form')!.reset();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(validated).toEqual([]);
  });

  test('a pending promise makes the field neutral, or keeps an earlier error; only the last result counts', async () => {
    const answers: ((value: string | null) => void)[] = [];
    const root = reactive({
      validationMode: 'change' as const,
      validate: () => new Promise<string | null>((resolve) => answers.push(resolve)),
    });
    const parts = await mountField({ root });
    await typeAtEnd(parts.input, 'a');
    await nextTick();
    answers[0]!(null);
    await settle();
    expect(parts.field).toHaveAttribute('data-valid');
    await typeAtEnd(parts.input, 'a');
    await nextTick();
    expect(dataAttributes(parts.field)).not.toContain('data-valid');
    answers[1]!('Wrong.');
    await settle();
    expect(parts.field).toHaveAttribute('data-invalid');
    await typeAtEnd(parts.input, 'b');
    await nextTick();
    expect(parts.field).toHaveAttribute('data-invalid');
    await typeAtEnd(parts.input, 'c');
    await nextTick();
    answers[2]!(null);
    await settle();
    expect(parts.field).toHaveAttribute('data-invalid');
    answers[3]!(null);
    await settle();
    expect(parts.field).toHaveAttribute('data-valid');
  });
});

describe('Field.Error', () => {
  test('with match, it shows only for that key', async () => {
    const { exposed, error } = await mountField({
      input: { required: true },
      errors: [{ match: 'typeMismatch' }],
    });
    exposed.field.validate();
    await nextTick();
    expect(error()).toBeNull();
  });

  test('it works with Transition, and it has no role', async () => {
    const root = reactive({ invalid: false });
    const { root: element } = mount(ErrorInTransition, { root });
    await nextTick();
    root.invalid = true;
    await nextTick();
    const error = element.firstElementChild!.querySelector(':scope > div')!;
    expect(error).toHaveClass('v-enter-from', 'v-enter-active');
    expect(error).not.toHaveAttribute('role');
    root.invalid = false;
    await nextTick();
    expect(error).toHaveClass('v-leave-active');
    expect(element.querySelector('input')).not.toHaveAttribute('aria-describedby');
  });
});

describe('in a form', () => {
  test('a field takes the mode of the form, and its errors by name', async () => {
    const validated: unknown[] = [];
    const form = reactive<Record<string, unknown>>({
      validationMode: 'change',
      errors: { email: 'Taken.' },
    });
    form['onUpdate:errors'] = (errors: Record<string, string>) => (form.errors = errors);
    const { root } = mount(FieldsInForm, {
      form,
      fields: [
        { root: recordValidate(validated, { name: 'email' }) },
        { root: { name: 'toString' } },
        { input: { name: 'empty' } },
      ],
    });
    await nextTick();
    const [email, other, empty] = root.querySelectorAll('form > div');
    expect(email).toHaveAttribute('data-invalid');
    expect(email!.querySelector('div')).toHaveTextContent('Taken.');
    expect(other).not.toHaveAttribute('data-invalid');
    form.errors = { empty: '', email: [] };
    await nextTick();
    expect(empty).not.toHaveAttribute('data-invalid');
    expect(email).not.toHaveAttribute('data-invalid');
    form.errors = { empty: 'Bad.' };
    await nextTick();
    expect(empty).toHaveAttribute('data-invalid');
    form.errors = { email: 'Taken.' };
    await nextTick();
    await typeAtEnd(email!.querySelector('input')!, 'a');
    await nextTick();
    expect(form.errors).toEqual({});
    expect(validated).toEqual(['a']);
  });

  test('a submit validates each field, and the field then validates at each change until a reset', async () => {
    const validated: unknown[] = [];
    const submitted = vi.fn();
    const { root } = mount(FieldsInForm, {
      form: { onSubmit: submitted },
      fields: [{ root: recordValidate(validated), input: { required: true } }],
    });
    await nextTick();
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'a');
    await nextTick();
    expect(validated).toEqual([]);
    await userEvent.keyboard('{Enter}');
    expect(validated).toEqual(['a']);
    expect(submitted).toHaveBeenCalledTimes(1);
    await typeAtEnd(input, 'b');
    await nextTick();
    expect(validated).toEqual(['a', 'ab']);
    root.querySelector('form')!.reset();
    await settle();
    await typeAtEnd(input, 'c');
    await nextTick();
    expect(validated).toEqual(['a', 'ab']);
  });
});

describe('KeepAlive', () => {
  test('a field that KeepAlive holds does not count for its form', async () => {
    const submitted = vi.fn();
    const scene = reactive({ shown: true });
    const { root } = mount(KeptAliveField, {
      scene,
      attrs: { required: true },
      form: { onSubmit: submitted },
    });
    await nextTick();
    const submit = root.querySelector<HTMLButtonElement>('button[type=submit]')!;
    submit.click();
    expect(submitted).not.toHaveBeenCalled();
    scene.shown = false;
    await nextTick();
    submit.click();
    expect(submitted).toHaveBeenCalledTimes(1);
    scene.shown = true;
    await nextTick();
    submit.click();
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});

describe('a native reset', () => {
  test('gives the field the state of its mount, and starts no validation', async () => {
    const validated: unknown[] = [];
    const onDirty = vi.fn();
    const onTouched = vi.fn();
    const { root } = mount(FieldsInForm, {
      fields: [
        {
          root: recordValidate(validated, {
            validationMode: 'blur',
            'onUpdate:dirty': onDirty,
            'onUpdate:touched': onTouched,
            validate: () => (validated.push('validate'), 'Wrong.'),
          }),
        },
      ],
    });
    await nextTick();
    const field = root.querySelector('form > div')!;
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'a');
    await leave(input);
    expect(field).toHaveAttribute('data-invalid');
    expect(input.validationMessage).toBe('Wrong.');
    root.querySelector('form')!.reset();
    await settle();
    expect(dataAttributes(field)).toEqual([]);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input.validationMessage).toBe('');
    expect(onDirty).toHaveBeenLastCalledWith(false);
    expect(onTouched).toHaveBeenLastCalledWith(false);
    expect(validated).toEqual(['validate']);
  });

  test('starts no validation in change mode, and starts the required rule again', async () => {
    const validated: unknown[] = [];
    const { root } = mount(FieldsInForm, {
      fields: [
        { root: recordValidate(validated, { validationMode: 'change' }) },
        { root: { validationMode: 'blur' }, input: { required: true } },
      ],
    });
    await nextTick();
    const [changeInput, requiredInput] = root.querySelectorAll('input');
    const requiredField = root.querySelectorAll('form > div')[1]!;
    await typeAtEnd(changeInput!, 'a');
    await typeAtEnd(requiredInput!, 'b');
    await userEvent.keyboard('{Backspace}');
    await leave(requiredInput!);
    expect(requiredField).toHaveAttribute('data-invalid');
    root.querySelector('form')!.reset();
    await settle();
    expect(validated).toEqual(['a']);
    requiredInput!.focus();
    await leave(requiredInput!);
    expect(requiredField).toHaveAttribute('data-valid');
  });
});

describe('accessibility', () => {
  test('no part adds a role, and the control never gets aria-invalid="false"', async () => {
    const { field, label, description, input } = await mountField({
      root: { validationMode: 'blur' },
    });
    input.focus();
    await leave(input);
    for (const element of [field, label, description]) expect(element).not.toHaveAttribute('role');
    expect(field).toHaveAttribute('data-valid');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Your full name.');
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('the parts', () => {
  test('a part outside Field.Root throws an error that names the family', () => {
    expect(String(mountError(PartOutsideRoot))).toMatch(/Field\b.*Field\.Label.*Field\.Root/);
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
