import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import ToggleInSlot from '../../test/fixtures/ToggleInSlot.vue';
import Toggles from '../../test/fixtures/Toggles.vue';
import TogglesInFieldset from '../../test/fixtures/TogglesInFieldset.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

describe('server render and hydration', () => {
  test.each([
    { name: 'a toggle', attrs: {}, attributes: ['aria-pressed', 'type'], pressed: 'false' },
    {
      name: 'a pressed toggle',
      attrs: { defaultPressed: true },
      attributes: ['aria-pressed', 'type'],
      pressed: 'true',
    },
    {
      name: 'a disabled toggle',
      attrs: { disabled: true },
      attributes: ['aria-pressed', 'disabled', 'type'],
      pressed: 'false',
    },
    {
      name: 'a disabled toggle that keeps the focus',
      attrs: { disabled: true, focusableWhenDisabled: true },
      attributes: ['aria-disabled', 'aria-pressed', 'type'],
      pressed: 'false',
    },
    {
      name: 'a toggle with a tag in as',
      attrs: { as: 'span' },
      attributes: ['aria-pressed', 'role', 'tabindex'],
      pressed: 'false',
    },
  ])(
    'the server HTML of $name has the attributes of its state, with no mismatch',
    async ({ attrs, attributes, pressed }) => {
      const props = { toggles: [attrs] };
      const root = await renderOnServer('Toggles', props);
      const toggle = root.querySelector('.Ancestor > *')!;
      expect(toggle.getAttributeNames().sort()).toEqual(attributes);
      expect(toggle).toHaveAttribute('aria-pressed', pressed);
      hydrate(Toggles, props, root);
      await nextTick();
      expect(root.querySelector('.Ancestor > *')).toBe(toggle);
      expect(toggle.getAttributeNames().sort()).toEqual(attributes);
    },
  );

  test('VUE-233: an element of the slot that is not a button has the attributes of a button and of another element in the server HTML, and gets its own attributes at the mount', async () => {
    const props = { scene: { tag: 'span' }, attrs: {} };
    const root = await renderOnServer('ToggleInSlot', props);
    const span = root.querySelector('.Ancestor > span')!;
    expect(span.getAttributeNames().sort()).toEqual(['aria-pressed', 'role', 'tabindex', 'type']);
    hydrate(ToggleInSlot, props, root);
    await nextTick();
    await nextTick();
    expect(root.querySelector('.Ancestor > span')).toBe(span);
    expect(span.getAttributeNames().sort()).toEqual(['aria-pressed', 'role', 'tabindex']);
  });

  test('the element slot wins over a tag in as, also in the server HTML', async () => {
    const props = { scene: { tag: 'button' }, attrs: { as: 'span' } };
    const root = await renderOnServer('ToggleInSlot', props);
    const button = root.querySelector('.Ancestor > *')!;
    expect(button.localName).toBe('button');
    expect(button.getAttributeNames().sort()).toEqual(['aria-pressed', 'role', 'tabindex', 'type']);
    hydrate(ToggleInSlot, props, root);
    await nextTick();
    await nextTick();
    expect(root.querySelector('.Ancestor > *')).toBe(button);
    expect(button.getAttributeNames().sort()).toEqual(['aria-pressed', 'type']);
  });

  test('VUE-112: the server HTML has the state of a disabled Fieldset.Root, and the hydration keeps it', async () => {
    const props = { scene: { kind: 'root', disabled: true } };
    const root = await renderOnServer('TogglesInFieldset', props);
    const toggle = root.querySelector('.Native')!;
    expect(toggle).toHaveTextContent('Native true');
    expect(toggle).toHaveAttribute('disabled');
    hydrate(TogglesInFieldset, props, root);
    await settle();
    expect(root.querySelector('.Native')).toBe(toggle);
    expect(toggle).toHaveTextContent('Native true');
    // The browser exempts the first legend, so the part knows it after the mount.
    await waitFor(() => expect(root.querySelector('.InLegend')).toHaveTextContent('Legend false'));
  });
});
