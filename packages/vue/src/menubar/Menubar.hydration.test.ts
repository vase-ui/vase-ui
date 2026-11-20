import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import MenubarParts from '../../test/fixtures/MenubarParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the bar with its native buttons, and the hydration gives the bar one tab stop', async () => {
    const root = await renderOnServer('MenubarParts');
    const bar = root.querySelector('[role="menubar"]')!;
    const triggers = [...bar.querySelectorAll('[role="menuitem"]')];
    expect(triggers.map((trigger) => trigger.getAttribute('tabindex'))).toEqual([null, null, null]);
    hydrate(MenubarParts, {}, root);
    await nextTick();
    expect(root.querySelector('[role="menubar"]')).toBe(bar);
    expect(triggers.map((trigger) => trigger.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
});
