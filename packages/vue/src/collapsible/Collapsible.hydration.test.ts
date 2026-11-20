import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import CollapsibleElements from '../../test/fixtures/CollapsibleElements.vue';
import CollapsibleParts from '../../test/fixtures/CollapsibleParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('VUE-3, VUE-80: the server HTML has an open panel with no variable, and the trigger before it names it after the hydration, with no message', async () => {
    const props = { root: { defaultOpen: true } };
    const root = await renderOnServer('CollapsibleParts', props);
    const trigger = root.querySelector('[aria-expanded]')!;
    const panel = root.querySelector<HTMLElement>('.Panel')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).not.toHaveAttribute('style');
    hydrate(CollapsibleParts, props, root);
    await nextTick();
    expect(root.querySelector('.Panel')).toBe(panel);
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
  });

  test.each([
    { name: 'a closed panel', panel: {}, hidden: undefined },
    { name: 'a kept panel', panel: { keepMounted: true }, hidden: '' },
    { name: 'a hiddenUntilFound panel', panel: { hiddenUntilFound: true }, hidden: 'until-found' },
  ])(
    'VUE-3: the server HTML of $name, and the value of hidden after its hydration with no message',
    async ({ panel, hidden }) => {
      const props = { panel };
      const root = await renderOnServer('CollapsibleParts', props);
      const element = root.querySelector('.Panel');
      if (hidden === undefined) expect(element).toBeNull();
      else {
        // Before Vue 3.5.41 and 3.6.0-rc.3, the server writes a bare `hidden`.
        expect(element).toHaveAttribute('hidden');
        expect(element?.hasAttribute('inert')).toBe(hidden === '');
      }
      hydrate(CollapsibleParts, props, root);
      await nextTick();
      expect(root.querySelector('.Panel')).toBe(element);
      if (element) expect(element).toHaveAttribute('hidden', hidden);
    },
  );

  test('a trigger with a tag in `as` has the attributes of that tag in the server HTML', async () => {
    const props = { trigger: { as: 'span' } };
    const root = await renderOnServer('CollapsibleParts', props);
    const trigger = root.querySelector('[aria-expanded]')!;
    expect(trigger.tagName).toBe('SPAN');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(trigger).not.toHaveAttribute('type');
    hydrate(CollapsibleParts, props, root);
    await nextTick();
    expect(root.querySelector('[aria-expanded]')).toBe(trigger);
  });

  test('a button of the `element` slot has the attributes of a button in the server HTML, also beside a tag in `as`', async () => {
    const props = { trigger: { as: 'span' }, triggerTag: 'button' };
    const root = await renderOnServer('CollapsibleElements', props);
    const trigger = root.querySelector('[aria-expanded]')!;
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).not.toHaveAttribute('role');
    expect(trigger).not.toHaveAttribute('tabindex');
    hydrate(CollapsibleElements, props, root);
    await nextTick();
    expect(root.querySelector('[aria-expanded]')).toBe(trigger);
    expect(trigger).not.toHaveAttribute('role');
  });
});
