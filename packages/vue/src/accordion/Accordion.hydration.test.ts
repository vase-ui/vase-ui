import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import AccordionParts from '../../test/fixtures/AccordionParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

const items = (...keys: string[]) => keys.map((key) => ({ key }));

describe('server render and hydration', () => {
  test('VUE-80: the server HTML has the open panel, which names its trigger; the trigger names the panel after the hydration, with no message', async () => {
    const props = { root: { defaultValue: ['a'] }, items: items('a', 'b') };
    const root = await renderOnServer('AccordionParts', props);
    const trigger = root.querySelector('[aria-expanded][data-key=a]')!;
    const panel = root.querySelector('[role=region][data-key=a]')!;
    expect(root.querySelectorAll('[role=region]')).toHaveLength(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    hydrate(AccordionParts, props, root);
    await nextTick();
    expect(root.querySelector('[role=region][data-key=a]')).toBe(panel);
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
  });

  test('a panel before its trigger names it after the hydration', async () => {
    const props = { root: { defaultValue: ['a'] }, items: items('a'), panelsFirst: true };
    const root = await renderOnServer('AccordionParts', props);
    const trigger = root.querySelector('[aria-expanded]')!;
    const panel = root.querySelector('[role=region]')!;
    expect(panel).not.toHaveAttribute('aria-labelledby');
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    hydrate(AccordionParts, props, root);
    await nextTick();
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
  });

  test('VUE-3: closed hiddenUntilFound panels have hidden in the server HTML, and hidden="until-found" after the hydration', async () => {
    const props = { root: { hiddenUntilFound: true }, items: items('a', 'b') };
    const root = await renderOnServer('AccordionParts', props);
    const panels = [...root.querySelectorAll('[role=region]')];
    // Before Vue 3.5.41 and 3.6.0-rc.3, the server writes a bare `hidden`.
    expect(panels.every((panel) => panel.hasAttribute('hidden'))).toBe(true);
    hydrate(AccordionParts, props, root);
    await nextTick();
    expect(panels.map((panel) => panel.getAttribute('hidden'))).toEqual([
      'until-found',
      'until-found',
    ]);
  });
});
