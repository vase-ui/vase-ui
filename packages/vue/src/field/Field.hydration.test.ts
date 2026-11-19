import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import FieldWithInput from '../../test/fixtures/FieldWithInput.vue';
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
    expect(input).toHaveAttribute('aria-describedby', 'first error');
    expect(root.querySelector('label')).toHaveAttribute('for', input.id);

    hydrate(PartsBeforeControl, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    expect(input).toHaveAttribute('aria-describedby', 'first error last');
  });
});
