import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import FieldControlIds from '../../test/fixtures/FieldControlIds.vue';
import FieldPartsReplaced from '../../test/fixtures/FieldPartsReplaced.vue';
import FieldWithInput from '../../test/fixtures/FieldWithInput.vue';
import PartsAfterControl from '../../test/fixtures/PartsAfterControl.vue';
import PartsBeforeControl from '../../test/fixtures/PartsBeforeControl.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the first state on the parts, and the hydration gives the rest', async () => {
    const props = {
      root: { name: 'name', disabled: true },
      input: { defaultValue: 'Colm' },
      errors: [],
    };
    const root = await renderOnServer('FieldWithInput', props);
    const field = root.firstElementChild!;
    const [label, input, description] = ['label', 'input', 'p'].map((selector) =>
      root.querySelector(selector)!,
    );
    for (const part of [field, label, description]) expect(part).toHaveAttribute('data-disabled');
    // The control gives its value when it renders, so the parts after it show it.
    for (const part of [input, description]) expect(part).toHaveAttribute('data-filled');
    expect(input).toHaveAttribute('name', 'name');
    expect(input).toHaveAttribute('disabled');
    expect(label).toHaveAttribute('for', input!.id);

    hydrate(FieldWithInput, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    for (const part of [field, label]) expect(part).toHaveAttribute('data-filled');
  });

  test('an error that shows at the first render is in the server HTML, with aria-invalid', async () => {
    const props = { root: { name: 'name' }, errors: { name: 'Taken.' } };
    const root = await renderOnServer('PartsBeforeControl', props);
    const input = root.querySelector('input')!;
    expect(root.querySelector('#error')).toHaveTextContent('Taken.');
    expect(root.querySelector('form > div')).toHaveAttribute('data-invalid');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'first error last');
    expect(root.querySelector('label')).toHaveAttribute('for', input.id);

    hydrate(PartsBeforeControl, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    expect(input).toHaveAttribute('aria-describedby', 'first error last');
  });

  test('VUE-17: the server HTML of a control names the label, the description and the error that come after it', async () => {
    const props = { root: { invalid: true } };
    const root = await renderOnServer('PartsAfterControl', props);
    const input = root.querySelector('input')!;
    expect(root.querySelector('label')).toHaveAttribute('for', input.id);
    expect(input).toHaveAttribute('aria-describedby', 'description error');
    hydrate(PartsAfterControl, props, root);
    await nextTick();
    expect(input).toHaveAttribute('aria-describedby', 'description error');
  });

  test('VUE-17: the server HTML of a control with no label has no aria-labelledby', async () => {
    const props = { scene: { label: false } };
    const root = await renderOnServer('FieldPartsReplaced', props);
    expect(root.querySelector('input')).not.toHaveAttribute('aria-labelledby');
    hydrate(FieldPartsReplaced, props, root);
    await nextTick();
    expect(root.querySelector('input')).not.toHaveAttribute('aria-labelledby');
  });

  test('the server HTML of a group and its radios names the label, the description and the error that come after them', async () => {
    const props = { root: { invalid: true }, group: true };
    const root = await renderOnServer('PartsAfterControl', props);
    const group = root.querySelector('[role=radiogroup]')!;
    expect(group).toHaveAttribute('aria-labelledby', root.querySelector('label')!.id);
    expect(group).toHaveAttribute('aria-describedby', 'description error');
    for (const radio of root.querySelectorAll('input')) {
      expect(radio).toHaveAttribute('aria-describedby', 'description error');
    }
    hydrate(PartsAfterControl, props, root);
    await nextTick();
    expect(group).toHaveAttribute('aria-describedby', 'description error');
  });
});

describe.each([
  ['input', 'input:not([type=hidden])'],
  ['input-element-slot', 'input'],
  ['checkbox', 'input[type=checkbox]'],
  ['switch', '[role=switch]'],
  ['radio', 'input[type=radio]'],
  ['number-field', 'input:not([type=hidden])'],
  ['select', '[role=combobox]'],
  ['select-trigger', '[role=combobox]'],
  ['combobox', '[role=combobox]'],
  ['date-field', '[role=spinbutton]'],
  ['otp-field', 'input:not([type=hidden])'],
])('VUE-219: the id prop of a control in a field: %s', (control, selector) => {
  async function render(label: string) {
    const props = { control, label };
    const root = await renderOnServer('FieldControlIds', props);
    const element = root.querySelector<HTMLElement>(selector)!;
    const serverId = element.id;
    const serverFor = root.querySelector('label')?.htmlFor;
    hydrate(FieldControlIds, props, root);
    await settle();
    expect(root.querySelector(selector)).toBe(element);
    return { root, element, serverId, serverFor };
  }

  test.each(['before', 'around'])(
    'a label %s the control names the id of the field in the server HTML; after the hydration the control has its id, and the label follows',
    async (label) => {
      const { root, element, serverId, serverFor } = await render(label);
      expect(serverId).not.toBe('own');
      expect(serverFor).toBe(serverId);
      expect(element.id).toBe('own');
      expect(root.querySelector('label')).toHaveAttribute('for', 'own');
    },
  );

  test('a label after the control names the id of the control in the server HTML', async () => {
    const { root, element, serverId, serverFor } = await render('after');
    expect(serverId).toBe('own');
    expect(serverFor).toBe('own');
    expect(element.id).toBe('own');
    expect(root.querySelector('label')).toHaveAttribute('for', 'own');
  });

  test('with no label, the server HTML has the id of the control', async () => {
    const { element, serverId } = await render('none');
    expect(serverId).toBe('own');
    expect(element.id).toBe('own');
  });
});
