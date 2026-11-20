import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector('[role="menu"]');

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    { name: 'a closed root with keepMounted', props: { portal: { keepMounted: true } } },
  ])('the server HTML of $name has its trigger only', async ({ props }) => {
    const root = await renderOnServer('MenuParts', props);
    expect(root.querySelectorAll('button[aria-haspopup="menu"]')).toHaveLength(1);
    expect(popupOf(root)).toBe(null);
  });

  test('an open root hydrates with no message, and its popup comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true } };
    const root = await renderOnServer('MenuParts', props);
    const trigger = root.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    hydrate(MenuParts, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
    expect(trigger).toHaveAttribute('aria-controls', popupOf(document.body)!.id);
  });

  test('a trigger in a disabled fieldset hydrates before it reads the fieldset', async () => {
    const props = { fieldset: true };
    const root = await renderOnServer('MenuParts', props);
    const trigger = root.querySelector('button')!;
    // The server has no element, so it cannot read a native fieldset.
    expect(trigger).toHaveTextContent('false');
    hydrate(MenuParts, props, root);
    await nextTick();
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('true');
  });

  test('a disabled portal renders the popup and its items in place in the server HTML', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true } };
    const root = await renderOnServer('MenuParts', props);
    const popup = popupOf(root)!;
    expect(popup).not.toBe(null);
    expect(popup.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    hydrate(MenuParts, props, root);
    await nextTick();
    expect(popupOf(root)).toBe(popup);
  });
});
