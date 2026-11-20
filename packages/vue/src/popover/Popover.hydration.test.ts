import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector('[role="dialog"]');

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    { name: 'a closed root with keepMounted', props: { portal: { keepMounted: true } } },
  ])('the server HTML of $name has its triggers only', async ({ props }) => {
    const root = await renderOnServer('PopoverParts', props);
    expect(root.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(1);
    expect(popupOf(root)).toBe(null);
  });

  test('an open root hydrates with no message, and its popup comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true } };
    const root = await renderOnServer('PopoverParts', props);
    const trigger = root.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    hydrate(PopoverParts, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
    expect(trigger).toHaveAttribute('aria-controls', popupOf(document.body)!.id);
  });

  test('a trigger and a close with a tag in `as` have the attributes of that tag in the server HTML', async () => {
    const root = await renderOnServer('PopoverParts', {
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { as: 'span' } }],
      portal: { disabled: true },
      close: { as: 'span', 'data-testid': 'close' },
    });
    for (const element of [
      root.querySelector('[data-key="t"]'),
      root.querySelector('[data-testid="close"]'),
    ]) {
      expect(element!.localName).toBe('span');
      expect(element).toHaveAttribute('role', 'button');
      expect(element).toHaveAttribute('tabindex', '0');
      expect(element).not.toHaveAttribute('type');
    }
  });

  test('a disabled portal renders the popup in place in the server HTML, hidden until its first place', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true } };
    const root = await renderOnServer('PopoverParts', props);
    const popup = popupOf(root)!;
    expect(popup).not.toBe(null);
    const positioner = popup.parentElement!;
    expect(positioner.style.visibility).toBe('hidden');
    hydrate(PopoverParts, props, root);
    await nextTick();
    expect(popupOf(root)).toBe(popup);
    await waitFor(() => expect(positioner.style.visibility).toBe(''));
  });
});
