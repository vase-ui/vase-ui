import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import FieldWithInput from '../../test/fixtures/FieldWithInput.vue';
import PartsAfterControl from '../../test/fixtures/PartsAfterControl.vue';
import PartsBeforeControl from '../../test/fixtures/PartsBeforeControl.vue';
import { hydrate, renderOnServer } from '../../test/render';

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
