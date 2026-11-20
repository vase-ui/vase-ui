import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import ContextMenuParts from '../../test/fixtures/ContextMenuParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

describe('server render and hydration', () => {
  test('the server HTML of an open root has its trigger only, and the popup comes after the mount', async () => {
    const props = { root: { defaultOpen: true } };
    const root = await renderOnServer('ContextMenuParts', props);
    const trigger = root.querySelector('[data-testid="trigger"]')!;
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(root.querySelector('[role="menu"]')).toBe(null);
    hydrate(ContextMenuParts, props, root);
    await nextTick();
    expect(root.querySelector('[data-testid="trigger"]')).toBe(trigger);
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBe(null));
  });
});
