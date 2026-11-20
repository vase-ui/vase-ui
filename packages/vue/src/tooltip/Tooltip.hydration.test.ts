import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import TooltipPart from '../../test/fixtures/TooltipPart.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector('[data-testid="popup-t"]');

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    { name: 'a closed root with keepMounted', props: { portal: { keepMounted: true } } },
  ])('the server HTML of $name has its triggers only', async ({ props }) => {
    const root = await renderOnServer('TooltipPart', props);
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(popupOf(root)).toBe(null);
  });

  test('a trigger has `data-popup-open` in the server HTML only when the open root names it; an open and disabled root is closed there', async () => {
    const triggers = [
      { key: 'a', attrs: { id: 'a' } },
      { key: 'b', attrs: { id: 'b' } },
    ];
    const named = await renderOnServer('TooltipPart', {
      root: { defaultOpen: true, defaultTriggerId: 'b' },
      triggers,
    });
    expect(named.querySelector('#a')).not.toHaveAttribute('data-popup-open');
    expect(named.querySelector('#b')).toHaveAttribute('data-popup-open');
    const disabled = await renderOnServer('TooltipPart', {
      root: { defaultOpen: true, disabled: true },
    });
    expect(disabled.querySelector('button')).not.toHaveAttribute('data-popup-open');
    expect(disabled.querySelector('button')).toHaveAttribute('data-trigger-disabled');
  });

  test('an open root hydrates with no message, and its popup comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true } };
    const root = await renderOnServer('TooltipPart', props);
    const trigger = root.querySelector('button')!;
    expect(trigger).toHaveAttribute('data-popup-open');
    hydrate(TooltipPart, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
  });

  test('a disabled portal renders the popup in place in the server HTML', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true } };
    const root = await renderOnServer('TooltipPart', props);
    const popup = popupOf(root)!;
    expect(popup).not.toBe(null);
    hydrate(TooltipPart, props, root);
    await nextTick();
    expect(popupOf(root)).toBe(popup);
  });
});
