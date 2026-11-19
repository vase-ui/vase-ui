import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { vModel } from '../../test/attrs';
import { dataAttributes, recordValidate } from '../../test/field';
import Inputs from '../../test/fixtures/Inputs.vue';
import InputsInForm from '../../test/fixtures/InputsInForm.vue';
import TwoInputsInField from '../../test/fixtures/TwoInputsInField.vue';
import { mount, settle, typeAtEnd } from '../../test/render';

// The parts after the control, and the control itself, register in the same render. The
// attributes that they give show after the next one.
async function mountInField(field: Record<string, unknown>, ...inputs: object[]) {
  const { root } = mount(Inputs, { inputs, field });
  await nextTick();
  return { field: root.firstElementChild!, inputs: [...root.querySelectorAll('input')] };
}

describe('what a field gives to its control', () => {
  test('a disabled field disables the control, and wins over its prop', async () => {
    const field = reactive({ disabled: true });
    const attrs = reactive({ disabled: false });
    const [input] = (await mountInField(field, attrs)).inputs;
    expect(input!.matches(':disabled')).toBe(true);
    expect(input).not.toHaveAttribute('data-disabled');
    field.disabled = false;
    await nextTick();
    expect(input!.matches(':disabled')).toBe(false);
    attrs.disabled = true;
    await nextTick();
    expect(input).toBeDisabled();
  });

  test('the name of the field wins over the prop of the control', async () => {
    const [input] = (await mountInField({ name: 'field' }, { name: 'control' })).inputs;
    expect(input).toHaveAttribute('name', 'field');
  });

  test('the state of the field gives the data attributes and aria-invalid', async () => {
    const field = reactive({ validationMode: 'blur', invalid: false });
    const [input] = (await mountInField(field, { required: true, defaultValue: 'a' })).inputs;
    expect(dataAttributes(input!)).toEqual(['data-filled']);
    await typeAtEnd(input!, 'b');
    input!.blur();
    await expect
      .poll(() => dataAttributes(input!))
      .toEqual(['data-dirty', 'data-filled', 'data-touched', 'data-valid']);
    expect(input).not.toHaveAttribute('aria-invalid');
    field.invalid = true;
    await nextTick();
    expect(dataAttributes(input!)).toEqual([
      'data-dirty',
      'data-filled',
      'data-invalid',
      'data-touched',
    ]);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('aria-describedby has the ids of the field, and the developer can replace or remove them', async () => {
    const [fromField, replaced, removed] = (
      await mountInField(
        { invalid: true },
        {},
        { 'aria-describedby': 'description' },
        { 'aria-describedby': null },
      )
    ).inputs;
    expect(fromField).toHaveAttribute('aria-describedby', 'description error');
    expect(replaced).toHaveAttribute('aria-describedby', 'description');
    expect(removed).not.toHaveAttribute('aria-describedby');
  });

  test('the label of the field names and activates the control, by its id or a generated id', async () => {
    const shown = reactive({ first: true, second: false });
    mount(TwoInputsInField, { field: {}, shown });
    await expect
      .element(page.getByRole('textbox', { name: 'Name' }))
      .toHaveAttribute('id', 'first');
    await userEvent.click(page.getByText('Name'));
    expect(document.activeElement).toHaveAttribute('id', 'first');
    const { field, inputs } = await mountInField({}, {});
    expect(inputs[0]!.id).not.toBe('');
    expect(field.querySelector('label')).toHaveAttribute('for', inputs[0]!.id);
  });
});

describe('what a control tells its field', () => {
  test('its element and id while it is mounted; a control that mounts before the old one unmounts wins', async () => {
    const shown = reactive({ first: true, second: false });
    const { root } = mount(TwoInputsInField, { field: {}, shown });
    const label = root.querySelector('label')!;
    await nextTick();
    expect(label).toHaveAttribute('for', 'first');
    shown.second = true;
    await nextTick();
    expect(label).toHaveAttribute('for', 'second');
    shown.first = false;
    await nextTick();
    expect(label).toHaveAttribute('for', 'second');
    shown.second = false;
    shown.first = true;
    await nextTick();
    expect(label).toHaveAttribute('for', 'first');
  });

  test('its value at the mount and after each change: from the user, the parent and a reset', async () => {
    const attrs = vModel('first');
    const { root } = mount(InputsInForm, { inputs: [attrs], field: {} });
    await nextTick();
    const field = root.querySelector('form > div')!;
    expect(dataAttributes(field)).toEqual(['data-filled']);
    await typeAtEnd(root.querySelector('input')!, 'x');
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled']);
    attrs.modelValue = '';
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-dirty']);
    root.querySelector('form')!.reset();
    await settle();
    expect(dataAttributes(field)).toEqual(['data-filled']);
  });

  test('a blur gives touched', async () => {
    const { field, inputs } = await mountInField({}, {});
    await userEvent.click(inputs[0]!);
    expect(dataAttributes(field)).toEqual([]);
    inputs[0]!.blur();
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-touched']);
  });

  test('that the user edited the control, or left it', async () => {
    const validated: unknown[] = [];
    const field = reactive(recordValidate(validated, { validationMode: 'change' }));
    const { inputs } = await mountInField(field, {});
    await typeAtEnd(inputs[0]!, 'a');
    await nextTick();
    expect(validated).toEqual(['a']);
    field.validationMode = 'blur';
    await nextTick();
    inputs[0]!.blur();
    await settle();
    expect(validated).toEqual(['a', 'a']);
  });
});
