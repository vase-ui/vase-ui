import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import ToggleGroupInToolbar from '../../test/fixtures/ToggleGroupInToolbar.vue';
import ToggleGroupParts from '../../test/fixtures/ToggleGroupParts.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

const tabindexes = (root: Element) =>
  [...root.querySelectorAll('[aria-pressed]')].map((toggle) => toggle.getAttribute('tabindex'));

describe('server render and hydration', () => {
  test.each([
    {
      name: 'a group with a pressed toggle',
      props: { group: { defaultValue: ['b'] }, items: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
      pressed: ['false', 'true', 'false'],
      tabStops: ['0', '-1', '-1'],
    },
    {
      name: 'a group whose first toggle is disabled',
      props: { items: [{ key: 'a', attrs: { disabled: true } }, { key: 'b' }] },
      pressed: ['false', 'false'],
      tabStops: ['-1', '0'],
    },
  ])(
    'the server HTML of $name has the role, data-orientation and aria-pressed, and no tabindex; the first enabled toggle is the tab stop after the hydration',
    async ({ props, pressed, tabStops }) => {
      const root = await renderOnServer('ToggleGroupParts', props);
      const group = root.querySelector('[role=group]')!;
      expect(group).toHaveAttribute('data-orientation', 'horizontal');
      const toggles = [...group.querySelectorAll('[aria-pressed]')];
      expect(toggles.map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(pressed);
      expect(tabindexes(group)).toEqual(pressed.map(() => null));
      hydrate(ToggleGroupParts, props, root);
      await nextTick();
      await nextTick();
      expect([...group.querySelectorAll('[aria-pressed]')]).toEqual(toggles);
      expect(tabindexes(group)).toEqual(tabStops);
    },
  );

  test('the server HTML of a disabled group has data-disabled and disabled toggles', async () => {
    const props = { group: { disabled: true }, items: [{ key: 'a' }] };
    const root = await renderOnServer('ToggleGroupParts', props);
    expect(root.querySelector('[role=group]')).toHaveAttribute('data-disabled', '');
    expect(root.querySelector('#a')).toHaveAttribute('disabled');
    hydrate(ToggleGroupParts, props, root);
    await nextTick();
    expect(root.querySelector('#a')).toHaveAttribute('disabled');
  });

  test('a group in a toolbar has no tabindex in the server HTML; after the hydration the toolbar gives the tab stop', async () => {
    const root = await renderOnServer('ToggleGroupInToolbar');
    const ids = ['first', 'one', 'two', 'alone', 'last'];
    const read = () => ids.map((id) => root.querySelector(`#${id}`)!.getAttribute('tabindex'));
    expect(read()).toEqual([null, null, null, null, null]);
    hydrate(ToggleGroupInToolbar, {}, root);
    await settle();
    expect(read()).toEqual(['0', '-1', '-1', '-1', '-1']);
    expect(root.querySelector('#one')).toHaveAttribute('aria-pressed', 'true');
  });

  test('after the hydration, a toolbar gives its tab stop to the first enabled toggle of a group', async () => {
    const props = { scene: { disabledSpan: true, noFirst: true } };
    const root = await renderOnServer('ToggleGroupInToolbar', props);
    const read = () =>
      ['one', 'two'].map((id) => root.querySelector(`#${id}`)!.getAttribute('tabindex'));
    hydrate(ToggleGroupInToolbar, props, root);
    await settle();
    expect(read()).toEqual(['-1', '0']);
  });

  test('a disabled Toolbar.Button that renders a Toggle has aria-disabled and no disabled in the server HTML, so Tab reaches it before the hydration', async () => {
    const props = { scene: { buttonDisabled: true } };
    const root = await renderOnServer('ToggleGroupInToolbar', props);
    const toggle = root.querySelector('#alone')!;
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).not.toHaveAttribute('disabled');
    hydrate(ToggleGroupInToolbar, props, root);
    await settle();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).not.toHaveAttribute('disabled');
  });
});
