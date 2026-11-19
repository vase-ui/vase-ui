import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { SwitchChangeEventDetails } from '@vase-ui/vue/switch';
import { dataAttributes } from '../../test/field';
import SwitchInField from '../../test/fixtures/SwitchInField.vue';
import SwitchParts from '../../test/fixtures/SwitchParts.vue';
import Switches from '../../test/fixtures/Switches.vue';
import { mount, settle } from '../../test/render';

/** Attributes of a switch that write each event in `log`, with `v-model` when `write`. */
function record(log: string[], attrs: Record<string, unknown> = {}, write = false) {
  const box: Record<string, unknown> = reactive({
    onCheckedChange: (checked: boolean) => log.push(`checkedChange ${checked}`),
    ...attrs,
  });
  box['onUpdate:modelValue'] = (checked: boolean) => {
    log.push(`update ${checked}`);
    if (write) box.modelValue = checked;
  };
  return box;
}

async function mountSwitches(switches: Record<string, unknown>[]) {
  const { root } = mount(Switches, { switches });
  await nextTick();
  const form = root.querySelector('form')!;
  return { root, form, inputs: [...form.querySelectorAll('input')] };
}

describe('the element', () => {
  test('is one native checkbox with role switch and the attributes of the developer, whose role wins', async () => {
    const { inputs } = await mountSwitches([
      { name: 'wifi', value: 'yes', class: 'Switch' },
      { role: 'checkbox' },
    ]);
    const [input, other] = inputs;
    expect(input!.type).toBe('checkbox');
    expect(input!.getAttributeNames().sort()).toEqual([
      'class',
      'id',
      'name',
      'role',
      'type',
      'value',
    ]);
    expect(input).toHaveAttribute('role', 'switch');
    expect(input!.id).not.toBe('');
    expect(other).toHaveAttribute('role', 'checkbox');
    await expect.element(page.getByRole('switch', { name: 'Switch 0' })).toBeInTheDocument();
  });

  test('the element slot renders the markup of the developer with the state; a template ref reaches the element; Transition works', async () => {
    const scene = reactive({ shown: false });
    const { root, exposed } = mount(SwitchParts, { scene });
    await nextTick();
    const [marked, styled] = root.querySelectorAll('input');
    expect(exposed.marked.element).toBe(marked);
    expect(exposed.styled.element).toBe(styled);
    expect(styled).toHaveAttribute('role', 'switch');
    marked!.click();
    await nextTick();
    expect(root.querySelector('.Track')).toHaveAttribute('data-on');
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('[aria-label=Shown]')).toHaveClass('v-enter-from', 'v-enter-active');
  });

  test('the state in the slot is disabled when a fieldset around it becomes disabled', async () => {
    const scene = reactive({ shown: false, fieldsetDisabled: false });
    const { root } = mount(SwitchParts, { scene });
    await settle();
    const fence = root.querySelector('.Fence')!;
    expect(fence).not.toHaveAttribute('data-disabled');
    scene.fieldsetDisabled = true;
    await expect.poll(() => fence.hasAttribute('data-disabled')).toBe(true);
  });
});

describe('the state', () => {
  test('a press emits checkedChange and then update:modelValue; a controlled switch shows its prop again', async () => {
    const log: string[] = [];
    const details: SwitchChangeEventDetails[] = [];
    const refused = record(log, { modelValue: false });
    refused.onCheckedChange = (checked: boolean, given: SwitchChangeEventDetails) => {
      log.push(`checkedChange ${checked}`);
      details.push(given);
    };
    const bound = record([], { modelValue: false }, true);
    const { inputs } = await mountSwitches([refused, bound]);
    inputs[0]!.click();
    expect(log).toEqual(['checkedChange true', 'update true']);
    expect(details[0]!.event.type).toBe('change');
    await settle();
    expect(inputs[0]!.checked).toBe(false);
    inputs[0]!.click();
    expect(log).toHaveLength(4);
    inputs[1]!.click();
    await nextTick();
    expect(bound.modelValue).toBe(true);
    bound.modelValue = false;
    await nextTick();
    expect(inputs[1]!.checked).toBe(false);
  });

  test('an uncontrolled switch starts at defaultChecked; an undefined modelValue keeps the state; a cancel keeps it', async () => {
    const log: string[] = [];
    const cancelled = record(log);
    cancelled.onCheckedChange = (_: boolean, details: SwitchChangeEventDetails) => details.cancel();
    const model = reactive<Record<string, unknown>>({ modelValue: true });
    const { inputs } = await mountSwitches([{ defaultChecked: true }, model, cancelled]);
    expect(inputs[0]!.checked).toBe(true);
    model.modelValue = undefined;
    await nextTick();
    expect(inputs[1]!.checked).toBe(true);
    inputs[2]!.click();
    await settle();
    expect(inputs[2]!.checked).toBe(false);
    expect(log).toEqual([]);
  });

  test('read-only: aria-readonly; a click, its label and Space change nothing; required has no effect', async () => {
    const log: string[] = [];
    const { root, form, inputs } = await mountSwitches([
      record(log, { readonly: true, required: true }),
    ]);
    const input = inputs[0]!;
    expect(input).toHaveAttribute('aria-readonly', 'true');
    expect(input).not.toHaveAttribute('readonly');
    input.click();
    await userEvent.click(root.querySelector('label')!);
    input.focus();
    await userEvent.keyboard(' ');
    expect(log).toEqual([]);
    expect(input.checked).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });
});

describe('native forms', () => {
  test('an on switch puts its name and value, or on, in the form data; a disabled one puts nothing', async () => {
    const { form, inputs } = await mountSwitches([
      { name: 'a', value: 'yes', defaultChecked: true },
      { name: 'b', defaultChecked: true },
      { name: 'c', defaultChecked: true, disabled: true },
    ]);
    expect(inputs[2]).toHaveAttribute('disabled');
    expect(inputs[2]).not.toHaveAttribute('aria-disabled');
    expect([...new FormData(form)]).toEqual([
      ['a', 'yes'],
      ['b', 'on'],
    ]);
  });

  test('a reset gives the default or the model of the mount, and emits only for a change', async () => {
    const log: string[] = [];
    const uncontrolled = reactive<Record<string, unknown>>({ defaultChecked: false });
    const bound = record(log, { modelValue: true }, true);
    const { root, form, inputs } = await mountSwitches([uncontrolled, bound]);
    inputs[1]!.click();
    await nextTick();
    // A reset goes to a default that changed after the mount.
    uncontrolled.defaultChecked = true;
    log.length = 0;
    form.reset();
    root.querySelector<HTMLFormElement>('#other')!.reset();
    await settle();
    expect(inputs[0]!.checked).toBe(true);
    expect(bound.modelValue).toBe(true);
    expect(log).toEqual(['update true']);
    form.reset();
    await settle();
    expect(log).toEqual(['update true']);
  });
});

describe('in a field', () => {
  test('the label names it and changes it; the field shows its state with aria-invalid and data attributes', async () => {
    const validated: unknown[] = [];
    const { root } = mount(SwitchInField, {
      field: {
        name: 'wifi',
        validationMode: 'change',
        validate: (value: unknown) => (validated.push(value), value ? 'No.' : null),
      },
      attrs: { name: 'other' },
    });
    await nextTick();
    const input = root.querySelector('input')!;
    const label = root.querySelector('label')!;
    expect(label).toHaveAttribute('for', input.id);
    expect(input.name).toBe('wifi');
    expect(input).toHaveAttribute('aria-describedby', 'description');
    await userEvent.click(label);
    await settle();
    expect(validated).toEqual([true]);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(dataAttributes(input)).toEqual(['data-dirty']);
    input.click();
    await settle();
    expect(dataAttributes(input)).toEqual(['data-valid']);
  });

  test('a cancelled press tells the field nothing', async () => {
    const { root } = mount(SwitchInField, {
      field: { validationMode: 'blur', validate: () => 'No.' },
      attrs: {
        onCheckedChange: (_: boolean, details: SwitchChangeEventDetails) => details.cancel(),
      },
    });
    await nextTick();
    const input = root.querySelector('input')!;
    input.focus();
    input.blur();
    await settle();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    input.click();
    await settle();
    // In this mode, an edit takes back the error of `validate`.
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(dataAttributes(input)).toEqual(['data-touched']);
  });

  test('a disabled field disables it; a read-only or disabled switch is not validated; a reset gives the field its first state', async () => {
    const field = reactive<Record<string, unknown>>({ invalid: true });
    const attrs = reactive<Record<string, unknown>>({ readonly: true });
    const { root } = mount(SwitchInField, { field, attrs });
    await nextTick();
    const input = root.querySelector('input')!;
    const fieldElement = root.querySelector('form > div')!;
    expect(input).not.toHaveAttribute('aria-invalid');
    attrs.readonly = false;
    attrs.disabled = true;
    await nextTick();
    expect(input).not.toHaveAttribute('aria-invalid');
    attrs.disabled = false;
    field.invalid = false;
    await nextTick();
    input.click();
    input.focus();
    input.blur();
    await settle();
    expect(fieldElement).toHaveAttribute('data-touched');
    root.querySelector('form')!.reset();
    await settle();
    expect(dataAttributes(fieldElement)).toEqual([]);
    field.disabled = true;
    await nextTick();
    expect(input.matches(':disabled')).toBe(true);
  });
});
