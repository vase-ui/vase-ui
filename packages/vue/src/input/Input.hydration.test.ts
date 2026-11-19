import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import Inputs from '../../test/fixtures/Inputs.vue';
import TextareaInSlot from '../../test/fixtures/TextareaInSlot.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the name, the value, an id and the first state, with no mismatch', async () => {
    const props = { inputs: [{ name: 'user', defaultValue: 'Colm' }], field: {} };
    const root = await renderOnServer('Inputs', props);
    const input = root.querySelector('input')!;
    expect(input).toHaveAttribute('name', 'user');
    expect(input).toHaveAttribute('value', 'Colm');
    expect(input.id).not.toBe('');
    expect(input).toHaveAttribute('data-filled', '');
    expect(input).not.toHaveAttribute('data-dirty');
    expect(root.querySelector('label')).toHaveAttribute('for', input.id);
    const serverId = input.id;

    hydrate(Inputs, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    expect(input).toHaveValue('Colm');
    expect(input.id).toBe(serverId);
    expect(root.querySelector('label')).toHaveAttribute('for', serverId);
  });

  test('the server HTML of a disabled input has disabled, so :disabled matches it', async () => {
    const props = { inputs: [{ disabled: true }] };
    const root = await renderOnServer('Inputs', props);
    expect(root.querySelector('input')).toHaveAttribute('disabled');
    expect(root.querySelector('input:disabled')).not.toBeNull();
    hydrate(Inputs, props, root);
  });

  test('the server HTML of a textarea in the slot has the value', async () => {
    const props = { attrs: { defaultValue: 'Colm' }, field: {} };
    const root = await renderOnServer('TextareaInSlot', props);
    const textarea = root.querySelector('textarea')!;
    expect(textarea).toHaveValue('Colm');
    hydrate(TextareaInSlot, props, root);
    await nextTick();
    expect(root.querySelector('textarea')).toBe(textarea);
  });
});
