import { describe, expect, test } from 'vitest';
import ToolbarElements from '../../test/fixtures/ToolbarElements.vue';
import ToolbarParts from '../../test/fixtures/ToolbarParts.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

const tabindexes = (root: Element, keys: string[]) =>
  keys.map((key) => root.querySelector(`#${key}`)!.getAttribute('tabindex'));

const parts = [
  { key: 'a' },
  { key: 'g', group: [{ key: 'b' }, { key: 'link', kind: 'link' }] },
  { key: 'text', kind: 'input', attrs: { defaultValue: 'Text' } },
];
const keys = ['a', 'b', 'link', 'text'];

describe('server render and hydration', () => {
  test('the server HTML has the roles, the orientation and the type of a button, and no tabindex; after the hydration the first item is the tab stop', async () => {
    const props = { root: { orientation: 'vertical' }, items: parts };
    const root = await renderOnServer('ToolbarParts', props);
    const toolbar = root.querySelector('[role=toolbar]')!;
    expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
    expect(root.querySelector('#g')).toHaveAttribute('role', 'group');
    expect(root.querySelector('#g')).toHaveAttribute('data-orientation', 'vertical');
    expect(root.querySelector('#a')).toHaveAttribute('type', 'button');
    expect(root.querySelector('#text')).toHaveAttribute('value', 'Text');
    for (const key of keys) {
      expect(root.querySelector(`#${key}`)).toHaveAttribute('data-orientation', 'vertical');
    }
    expect(tabindexes(root, keys)).toEqual([null, null, null, null]);
    const button = root.querySelector('#a');
    hydrate(ToolbarParts, props, root);
    await settle();
    expect(root.querySelector('#a')).toBe(button);
    expect(tabindexes(root, keys)).toEqual(['0', '-1', '-1', '-1']);
  });

  test('a disabled toolbar has aria-disabled in the server HTML, and a read-only input; after the hydration the first item is the tab stop', async () => {
    const props = { root: { disabled: true }, items: parts };
    const root = await renderOnServer('ToolbarParts', props);
    for (const key of ['a', 'b', 'text']) {
      expect(root.querySelector(`#${key}`)).toHaveAttribute('aria-disabled', 'true');
      expect(root.querySelector(`#${key}`)).not.toHaveAttribute('disabled');
    }
    expect(root.querySelector('#text')).toHaveAttribute('readonly');
    expect(root.querySelector('#link')).not.toHaveAttribute('aria-disabled');
    hydrate(ToolbarParts, props, root);
    await settle();
    expect(tabindexes(root, keys)).toEqual(['0', '-1', '-1', '-1']);
  });

  test('a first item that is disabled and cannot take the focus has disabled in the server HTML; after the hydration the next item is the tab stop', async () => {
    const props = {
      items: [{ key: 'a', attrs: { disabled: true, focusableWhenDisabled: false } }, { key: 'b' }],
    };
    const root = await renderOnServer('ToolbarParts', props);
    expect(root.querySelector('#a')).toHaveAttribute('disabled');
    hydrate(ToolbarParts, props, root);
    await settle();
    expect(tabindexes(root, ['a', 'b'])).toEqual(['-1', '0']);
  });

  test('a separator is across the toolbar, and a tag in as stays, in the server HTML and after the hydration', async () => {
    const root = await renderOnServer('ToolbarElements', { scene: {} });
    const separator = root.querySelector('[role=separator]')!;
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(root.querySelector('[role=toolbar]')!.localName).toBe('section');
    // A tag in `as` is known before the mount, so the server HTML has the attributes of a span.
    const button = root.querySelector('.Button')!;
    expect(button).toHaveAttribute('role', 'button');
    expect(button).toHaveAttribute('tabindex', '0');
    expect(button).not.toHaveAttribute('type');
    hydrate(ToolbarElements, { scene: {} }, root);
    await settle();
    expect(root.querySelector('[role=separator]')).toBe(separator);
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('a separator in an <hr>, which has no content, hydrates', async () => {
    const props = {
      items: [{ key: 'a' }, { key: 'line', kind: 'separator', attrs: { as: 'hr' } }],
    };
    const root = await renderOnServer('ToolbarParts', props);
    const separator = root.querySelector('#line')!;
    expect(separator.localName).toBe('hr');
    hydrate(ToolbarParts, props, root);
    await settle();
    expect(root.querySelector('#line')).toBe(separator);
  });
});
