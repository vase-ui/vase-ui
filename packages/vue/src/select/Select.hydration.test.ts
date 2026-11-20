import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const listboxOf = (root: ParentNode) => root.querySelector('[role="listbox"]');

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: { root: { defaultValue: 'banana', name: 'fruit' } } },
    { name: 'an open root', props: { root: { defaultOpen: true, name: 'fruit' } } },
  ])(
    'the server HTML of $name has the root element, the label, the trigger and the form inputs, and no popup',
    async ({ props }) => {
      const root = await renderOnServer('SelectParts', { ...props, label: {} });
      const element = root.querySelector('[data-testid="root"]')!;
      expect(element.localName).toBe('div');
      expect(element.querySelector('[data-testid="label"]')).not.toBe(null);
      expect(element.querySelector('button[role="combobox"]')).not.toBe(null);
      expect(element.querySelector('input[aria-hidden="true"]')).not.toBe(null);
      expect(element.querySelector('input[type="hidden"][name="fruit"]')).not.toBe(null);
      expect(listboxOf(root)).toBe(null);
    },
  );

  test('the trigger has the text of the value in the server HTML', async () => {
    const root = await renderOnServer('SelectParts', {
      root: { defaultValue: 'banana', items: { banana: 'Yellow banana' } },
    });
    expect(root.querySelector('button')).toHaveTextContent('Yellow banana');
  });

  test('VUE-51: the server HTML names a label that comes after the trigger, and the page hydrates with no message', async () => {
    const props = { labelAfter: {}, root: { defaultValue: 'banana' } };
    const root = await renderOnServer('SelectParts', props);
    const trigger = root.querySelector('button')!;
    const label = root.querySelector('[data-testid="label"]')!;
    expect(trigger).toHaveAttribute('aria-labelledby', label.id);
    hydrate(SelectParts, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await userEvent.click(trigger);
    await waitFor(() => expect(listboxOf(document.body)).not.toBe(null));
  });

  test('a disabled portal of an open root renders the popup in place, hidden until its first place', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true } };
    const root = await renderOnServer('SelectParts', props);
    const popup = listboxOf(root)!;
    expect(popup).not.toBe(null);
    const positioner = popup.parentElement!;
    expect(positioner.style.visibility).toBe('hidden');
    hydrate(SelectParts, props, root);
    await nextTick();
    expect(listboxOf(root)).toBe(popup);
    await waitFor(() => expect(positioner.style.visibility).toBe(''));
  });
});
