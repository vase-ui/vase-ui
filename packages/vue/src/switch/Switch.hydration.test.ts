import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import SwitchInField from '../../test/fixtures/SwitchInField.vue';
import Switches from '../../test/fixtures/Switches.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML is a checkbox with role switch and its attributes, with no mismatch', async () => {
    const props = {
      switches: [
        { name: 'wifi', value: 'yes', defaultChecked: true },
        { disabled: true, readonly: true, required: true },
      ],
    };
    const root = await renderOnServer('Switches', props);
    const [on, off] = root.querySelectorAll('input');
    expect(on).toHaveAttribute('role', 'switch');
    expect(on!.checked).toBe(true);
    expect(on!.name).toBe('wifi');
    expect(on!.value).toBe('yes');
    expect(off).toHaveAttribute('disabled');
    expect(off).toHaveAttribute('aria-readonly', 'true');
    hydrate(Switches, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(on);
  });

  test('the server HTML of a disabled switch that keeps the focus has aria-disabled and no disabled, name or required, with no mismatch', async () => {
    const props = {
      switches: [
        {
          name: 'wifi',
          defaultChecked: true,
          disabled: true,
          required: true,
          focusableWhenDisabled: true,
        },
      ],
    };
    const root = await renderOnServer('Switches', props);
    const input = root.querySelector('input')!;
    expect(input).toHaveAttribute('role', 'switch');
    expect(input).toHaveAttribute('aria-disabled', 'true');
    expect(input).not.toHaveAttribute('disabled');
    expect(input).not.toHaveAttribute('name');
    expect(input).not.toHaveAttribute('required');
    expect(input.checked).toBe(true);
    hydrate(Switches, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    expect(input).toHaveAttribute('aria-disabled', 'true');
    expect(input).not.toHaveAttribute('disabled');
    expect(input).not.toHaveAttribute('name');
    expect(input).not.toHaveAttribute('required');
  });

  test.each([false, true])(
    'in a field, the label names the server id; a label after the switch has data-filled; the hydration gives the rest (label after: %s)',
    async (labelAfter) => {
      const props = { field: {}, attrs: { defaultChecked: true }, labelAfter };
      const root = await renderOnServer('SwitchInField', props);
      const input = root.querySelector('input')!;
      const label = root.querySelector('label')!;
      expect(label).toHaveAttribute('for', input.id);
      // Only a part that renders after the switch has the state of the switch in the server HTML.
      if (labelAfter) expect(label).toHaveAttribute('data-filled');
      hydrate(SwitchInField, props, root);
      await nextTick();
      expect(input).toHaveAttribute('aria-describedby', 'description');
      for (const part of [root.querySelector('form > div'), label])
        expect(part).toHaveAttribute('data-filled');
    },
  );
});
