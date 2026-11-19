import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import Checkboxes from '../../test/fixtures/Checkboxes.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the attributes and data-indeterminate; the hydration gives :indeterminate', async () => {
    const props = {
      boxes: [
        { name: 'agree', value: 'yes', defaultChecked: true, required: true, indeterminate: true },
        { disabled: true },
      ],
    };
    const root = await renderOnServer('Checkboxes', props);
    const [box, disabled] = root.querySelectorAll('input');
    const id = box!.id;
    expect(id).not.toBe('');
    expect(box!.checked).toBe(true);
    expect(box!.name).toBe('agree');
    expect(box!.value).toBe('yes');
    expect(box!.required).toBe(true);
    expect(box).toHaveAttribute('data-indeterminate');
    expect(disabled).toHaveAttribute('disabled');
    hydrate(Checkboxes, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(box);
    expect(box!.id).toBe(id);
    expect(box!.matches(':indeterminate')).toBe(true);
  });
});
