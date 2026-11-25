import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import PreviewCardParts from '../../test/fixtures/PreviewCardParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector('[data-testid="popup"]');
const twoLinks = [{ key: 'a' }, { key: 'b' }];

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    {
      name: 'an open root with two links and a trigger id',
      props: { root: { defaultOpen: true, defaultTriggerId: 'b' }, triggers: twoLinks },
    },
    { name: 'a closed root with keepMounted', props: { portal: { keepMounted: true } } },
  ])('the server HTML of $name has its links only', async ({ props }) => {
    const root = await renderOnServer('PreviewCardParts', props);
    expect(root.querySelectorAll('a')).toHaveLength('triggers' in props ? 2 : 1);
    expect(popupOf(root)).toBe(null);
  });

  test('the active link of an open root has `data-popup-open`; an open root with two links and no trigger id hydrates with no message and has no active link', async () => {
    const chosen = await renderOnServer('PreviewCardParts', {
      root: { defaultOpen: true, defaultTriggerId: 'b' },
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
      ],
    });
    expect([...chosen.querySelectorAll('[data-popup-open]')].map((link) => link.id)).toEqual(['b']);
    const props = { root: { defaultOpen: true }, triggers: twoLinks };
    const none = await renderOnServer('PreviewCardParts', props);
    hydrate(PreviewCardParts, props, none);
    await nextTick();
    expect(none.querySelectorAll('[data-popup-open]')).toHaveLength(0);
  });

  test('an open root hydrates with no message, and its card comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true }, triggers: [{ key: 't', attrs: { id: 'link' } }] };
    const root = await renderOnServer('PreviewCardParts', props);
    const link = root.querySelector('a')!;
    expect(link).toHaveAttribute('data-popup-open');
    hydrate(PreviewCardParts, props, root);
    await nextTick();
    expect(root.querySelector('a')).toBe(link);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
  });

  test('a disabled portal of an open root renders the shown popup and backdrop in place with no `display: none`, and hydrates with no message', async () => {
    const props = {
      root: { defaultOpen: true },
      portal: { disabled: true },
      backdrop: {},
    };
    const root = await renderOnServer('PreviewCardParts', props);
    const element = popupOf(root) as HTMLElement;
    const backdrop = root.querySelector<HTMLElement>('[data-testid="backdrop"]')!;
    expect(element.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    hydrate(PreviewCardParts, props, root);
    await nextTick();
    expect(popupOf(root)).toBe(element);
    expect(root.querySelector('[data-testid="backdrop"]')).toBe(backdrop);
    expect(element.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
  });
});
