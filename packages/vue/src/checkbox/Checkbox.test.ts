import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { CheckboxChangeEventDetails } from '@vase-ui/vue/checkbox';
import { dataAttributes } from '../../test/field';
import CheckboxInField from '../../test/fixtures/CheckboxInField.vue';
import CheckboxInSlot from '../../test/fixtures/CheckboxInSlot.vue';
import CheckboxInTransition from '../../test/fixtures/CheckboxInTransition.vue';
import Checkboxes from '../../test/fixtures/Checkboxes.vue';
import { mount, settle } from '../../test/render';

/** Attributes of a checkbox that write each event in `log`. */
function record(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onCheckedChange: (checked: boolean) => log.push(`checkedChange ${checked}`),
    'onUpdate:modelValue': (checked: boolean) => log.push(`update ${checked}`),
    'onUpdate:indeterminate': (value: boolean) => log.push(`indeterminate ${value}`),
    ...attrs,
  });
}

/** `v-model` and `v-model:indeterminate` on a checkbox, with the log of `record`. */
function models(log: string[], attrs: Record<string, unknown>) {
  const box = record(log, attrs);
  box['onUpdate:modelValue'] = (checked: boolean) => {
    log.push(`update ${checked}`);
    box.modelValue = checked;
  };
  box['onUpdate:indeterminate'] = (value: boolean) => {
    log.push(`indeterminate ${value}`);
    box.indeterminate = value;
  };
  return box;
}

async function mountBoxes(boxes: Record<string, unknown>[], formAttrs?: Record<string, unknown>) {
  const { root } = mount(Checkboxes, { boxes, formAttrs });
  await nextTick();
  const form = root.querySelector('form')!;
  return { root, form, boxes: [...form.querySelectorAll('input')] };
}

describe('the element', () => {
  test('is one native checkbox with the attributes of the developer and an id', async () => {
    const { boxes } = await mountBoxes([
      { name: 'agree', value: 'yes', required: true, class: 'Box', 'aria-describedby': 'hint' },
      { id: 'own' },
    ]);
    const [box, own] = boxes;
    expect(box!.type).toBe('checkbox');
    expect(box!.id).not.toBe('');
    expect(own!.id).toBe('own');
    expect(box!.getAttributeNames().sort()).toEqual([
      'aria-describedby',
      'class',
      'id',
      'name',
      'required',
      'type',
      'value',
    ]);
  });

  test('the element slot renders the markup of the developer with the state; a template ref reaches the element', async () => {
    const attrs = reactive<Record<string, unknown>>({});
    const { root, exposed } = mount(CheckboxInSlot, { attrs });
    await nextTick();
    const [box, styled] = root.querySelectorAll('input');
    const mark = root.querySelector('.Box')!;
    expect(exposed.box.element).toBe(box);
    expect(exposed.styled.element).toBe(styled);
    expect(styled).toHaveClass('StyledInput');
    expect(styled!.type).toBe('checkbox');
    expect(mark).toHaveAttribute('data-mark', 'none');
    box!.click();
    await nextTick();
    expect(mark).toHaveAttribute('data-mark', 'check');
    attrs.indeterminate = true;
    await nextTick();
    expect(mark).toHaveAttribute('data-mark', 'mixed');
  });

  test('renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(CheckboxInTransition, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('input')).toHaveClass('v-enter-from', 'v-enter-active');
    expect(root.querySelector('[role=group]')).toHaveClass('v-enter-from', 'v-enter-active');
  });
});

describe('a press', () => {
  test('emits checkedChange with the details and then update:modelValue, before click() returns', async () => {
    const log: string[] = [];
    const details: CheckboxChangeEventDetails[] = [];
    const box = record(log);
    box.onCheckedChange = (checked: boolean, given: CheckboxChangeEventDetails) => {
      log.push(`checkedChange ${checked}`);
      details.push(given);
    };
    const { boxes } = await mountBoxes([box]);
    boxes[0]!.click();
    expect(log).toEqual(['checkedChange true', 'update true']);
    expect(details[0]!.reason).toBe('none');
    expect(details[0]!.event.type).toBe('change');
    expect(details[0]!.isCanceled).toBe(false);
  });

  test('a controlled checkbox shows the prop again when the parent does not write it, and follows v-model', async () => {
    const log: string[] = [];
    const { boxes } = await mountBoxes([
      record(log, { modelValue: false }),
      models(log, { modelValue: false }),
    ]);
    const [refused, bound] = boxes;
    refused!.click();
    await settle();
    expect(refused!.checked).toBe(false);
    refused!.click();
    expect(log).toEqual(['checkedChange true', 'update true', 'checkedChange true', 'update true']);
    bound!.click();
    await nextTick();
    expect(bound!.checked).toBe(true);
  });

  test('an uncontrolled checkbox starts at defaultChecked and keeps its state; an undefined modelValue keeps it too', async () => {
    const first = reactive<Record<string, unknown>>({ defaultChecked: true });
    const second = reactive<Record<string, unknown>>({ modelValue: true });
    const { boxes } = await mountBoxes([first, second]);
    expect(boxes[0]!.checked).toBe(true);
    boxes[0]!.click();
    first.defaultChecked = true;
    await nextTick();
    expect(boxes[0]!.checked).toBe(false);
    second.modelValue = undefined;
    await nextTick();
    expect(boxes[1]!.checked).toBe(true);
    boxes[1]!.click();
    await nextTick();
    expect(boxes[1]!.checked).toBe(false);
  });

  test('a cancel keeps the checked and indeterminate state and emits nothing more', async () => {
    const log: string[] = [];
    const box = record(log, { indeterminate: true });
    box.onCheckedChange = (checked: boolean, details: CheckboxChangeEventDetails) => {
      log.push(`checkedChange ${checked}`);
      details.cancel();
    };
    const { boxes } = await mountBoxes([box]);
    boxes[0]!.click();
    await settle();
    expect(log).toEqual(['checkedChange true']);
    expect(boxes[0]!.checked).toBe(false);
    expect(boxes[0]!.indeterminate).toBe(true);
  });
});

describe('indeterminate', () => {
  test('the element follows the prop, with :indeterminate and data-indeterminate', async () => {
    const box = reactive<Record<string, unknown>>({ indeterminate: true, defaultChecked: true });
    const { boxes } = await mountBoxes([box]);
    expect(boxes[0]!.matches(':indeterminate')).toBe(true);
    expect(dataAttributes(boxes[0]!)).toEqual(['data-indeterminate']);
    box.indeterminate = false;
    await nextTick();
    expect(boxes[0]!.matches(':indeterminate')).toBe(false);
    expect(dataAttributes(boxes[0]!)).toEqual([]);
  });

  test('a press emits update:indeterminate last; v-model:indeterminate ends it, a parent that keeps it keeps it', async () => {
    const log: string[] = [];
    const { boxes } = await mountBoxes([
      models(log, { modelValue: false, indeterminate: true }),
      record([], { indeterminate: true }),
    ]);
    boxes[0]!.click();
    boxes[1]!.click();
    await settle();
    expect(log).toEqual(['checkedChange true', 'update true', 'indeterminate false']);
    expect(boxes[0]!.indeterminate).toBe(false);
    expect(boxes[1]!.indeterminate).toBe(true);
    expect(boxes[1]!.checked).toBe(true);
  });
});

describe('read-only', () => {
  test('has aria-readonly; a click, its label and Space change nothing; required has no effect', async () => {
    const log: string[] = [];
    const { root, form, boxes } = await mountBoxes([
      record(log, { readonly: true, required: true }),
    ]);
    const box = boxes[0]!;
    expect(box).toHaveAttribute('aria-readonly', 'true');
    expect(box).not.toHaveAttribute('data-readonly');
    expect(box).not.toHaveAttribute('readonly');
    box.click();
    await userEvent.click(root.querySelector('label')!);
    box.focus();
    await userEvent.keyboard(' ');
    expect(log).toEqual([]);
    expect(box.checked).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });
});

describe('native forms', () => {
  test('a checked checkbox puts its name and value, or on, in the form data', async () => {
    const { form } = await mountBoxes([
      { name: 'a', value: 'x', defaultChecked: true },
      { name: 'b', defaultChecked: true },
      { name: 'c' },
      { name: 'd', defaultChecked: true, disabled: true },
    ]);
    expect([...new FormData(form)]).toEqual([
      ['a', 'x'],
      ['b', 'on'],
    ]);
  });

  test('a reset gives the first state and emits update:modelValue only for a change; it keeps indeterminate', async () => {
    const log: string[] = [];
    const bound = models(log, { modelValue: true });
    const { form, boxes } = await mountBoxes([
      { defaultChecked: true, indeterminate: true },
      bound,
      record(log, { modelValue: false }),
    ]);
    boxes[0]!.click();
    boxes[1]!.click();
    await nextTick();
    log.length = 0;
    form.reset();
    await settle();
    expect(boxes[0]!.checked).toBe(true);
    expect(boxes[0]!.indeterminate).toBe(true);
    expect(bound.modelValue).toBe(true);
    expect(log).toEqual(['update true']);
  });

  test('a prevented reset and a reset of another form change nothing', async () => {
    const { root, form, boxes } = await mountBoxes([{ defaultChecked: true }]);
    boxes[0]!.click();
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
    form.reset();
    root.querySelector<HTMLFormElement>('#other')!.reset();
    await settle();
    expect(boxes[0]!.checked).toBe(false);
  });
});

describe('in a field', () => {
  test('the label names it, a click on the label changes it, and the field gets the state', async () => {
    const validated: unknown[] = [];
    const { root } = mount(CheckboxInField, {
      field: {
        validationMode: 'change',
        validate: (value: unknown) => (validated.push(value), value ? null : 'Tick it.'),
      },
    });
    await nextTick();
    const field = root.querySelector('form > div')!;
    const box = root.querySelector('input')!;
    expect(root.querySelector('label')).toHaveAttribute('for', box.id);
    await userEvent.click(root.querySelector('label')!);
    await nextTick();
    expect(box.checked).toBe(true);
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled', 'data-valid']);
    expect(dataAttributes(box)).toEqual(['data-dirty', 'data-valid']);
    box.click();
    await settle();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(field).not.toHaveAttribute('data-filled');
    expect(validated).toEqual([true, false]);
  });

  test('in blur mode, a press after an error makes the field valid at once', async () => {
    const { root } = mount(CheckboxInField, {
      field: { validationMode: 'blur', validate: (value: unknown) => (value ? null : 'Tick it.') },
    });
    await nextTick();
    const field = root.querySelector('form > div')!;
    const box = root.querySelector('input')!;
    box.focus();
    box.blur();
    await settle();
    expect(field).toHaveAttribute('data-invalid');
    box.click();
    await settle();
    expect(field).toHaveAttribute('data-valid');
  });

  test('a read-only checkbox is not validated; a reset gives the field the state of its mount', async () => {
    const box = reactive<Record<string, unknown>>({ required: true });
    const { root } = mount(CheckboxInField, { field: { validationMode: 'change' }, box });
    await nextTick();
    const field = root.querySelector('form > div')!;
    const input = root.querySelector('input')!;
    input.click();
    await settle();
    input.click();
    await settle();
    expect(field).toHaveAttribute('data-invalid');
    box.readonly = true;
    await nextTick();
    expect(field).not.toHaveAttribute('data-invalid');
    box.readonly = false;
    root.querySelector('form')!.reset();
    await settle();
    expect(dataAttributes(field)).toEqual([]);
    expect(input.validity.valueMissing).toBe(true);
  });
});
