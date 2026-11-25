import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

const byTestId = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultValue: 'one' } } },
    { name: 'an open inline root', props: { root: { defaultValue: 'one' }, inline: true } },
  ])(
    'the server HTML of $name has the root, the list, the triggers, the icons and the links of the list, and no content',
    async ({ props }) => {
      const root = await renderOnServer('NavigationMenuParts', props);
      expect(byTestId(root, 'root')!.localName).toBe('nav');
      expect(byTestId(root, 'list')!.localName).toBe('ul');
      expect(byTestId(root, 'trigger-one')).toHaveAttribute(
        'aria-expanded',
        props.root ? 'true' : 'false',
      );
      expect(byTestId(root, 'icon-one')).toHaveTextContent('▼');
      expect(byTestId(root, 'link-blog')).toHaveAttribute('href', '#blog');
      expect(byTestId(root, 'popup')).toBe(null);
      expect(byTestId(root, 'content-one')).toBe(null);
    },
  );

  test('a kept content is hidden in its item in the server HTML', async () => {
    const root = await renderOnServer('NavigationMenuParts', {
      contents: { one: { keepMounted: true } },
    });
    const content = byTestId(root, 'content-one')!;
    expect(content).toHaveAttribute('hidden');
    expect(content.parentElement!.localName).toBe('li');
    expect(content.querySelector('a')).toHaveAttribute('href', '#one-a');
  });

  test.each([
    { name: 'an open root', props: { root: { defaultValue: 'one' } } },
    {
      name: 'an open root with a kept content',
      props: { root: { defaultValue: 'one' }, contents: { one: { keepMounted: true } } },
    },
    { name: 'an open inline root', props: { root: { defaultValue: 'one' }, inline: true } },
  ])('$name hydrates with no message, and its content shows after the mount', async ({ props }) => {
    const root = await renderOnServer('NavigationMenuParts', props);
    const trigger = byTestId(root, 'trigger-one');
    hydrate(NavigationMenuParts, props, root);
    await nextTick();
    expect(byTestId(root, 'trigger-one')).toBe(trigger);
    await waitFor(() => expect(byTestId(document, 'content-one')).not.toBe(null));
    await waitFor(() => expect(byTestId(document, 'content-one')).not.toHaveAttribute('hidden'));
    expect(byTestId(document, 'viewport')!.contains(byTestId(document, 'content-one'))).toBe(true);
    expect(takeReportedMessages()).toEqual([]);
  });

  test('a disabled portal of an open root renders the shown popup and backdrop in place with no `display: none`, and hydrates with no message', async () => {
    const props = {
      root: { defaultValue: 'one' },
      portal: { disabled: true },
      backdrop: {},
    };
    const root = await renderOnServer('NavigationMenuParts', props);
    const popup = byTestId(root, 'popup')!;
    const backdrop = byTestId(root, 'backdrop')!;
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    hydrate(NavigationMenuParts, props, root);
    await nextTick();
    expect(byTestId(root, 'popup')).toBe(popup);
    expect(byTestId(root, 'backdrop')).toBe(backdrop);
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    await waitFor(() => expect(byTestId(root, 'content-one')).not.toBe(null));
    expect(byTestId(root, 'viewport')!.contains(byTestId(root, 'content-one'))).toBe(true);
    expect(takeReportedMessages()).toEqual([]);
  });
});
