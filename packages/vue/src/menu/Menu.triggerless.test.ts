import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import type { MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import type { MenuEntry } from '../../test/fixtures/menuEntries';
import { active, closed, item, mountTree, opened, popup } from '../../test/menuFilter';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

/** A plain menu with no trigger, at the anchor of its positioner. */
function mountTriggerless(
  entries: MenuEntry[],
  options: { root?: Props; portal?: Props; positioner?: Props } = {},
) {
  return mountTree({
    provider: false,
    trigger: false,
    input: false,
    list: false,
    positioner: { anchor: document.body, ...options.positioner },
    root: { defaultOpen: true, modal: false, ...options.root },
    portal: options.portal,
    entries,
  });
}

const changes = (log: string[]) => (open: boolean, details: MenuRootChangeEventDetails) =>
  log.push(`${open} ${details.reason}`);

describe('a menu with no trigger', () => {
  test.each([
    { dir: 'ltr', keepMounted: false },
    { dir: 'ltr', keepMounted: true },
    { dir: 'rtl', keepMounted: false },
    { dir: 'rtl', keepMounted: true },
  ])(
    'Escape in a submenu closes the submenu only, and the focus stays in the menu: $dir, keepMounted $keepMounted',
    async ({ dir, keepMounted }) => {
      const log: string[] = [];
      await mountTriggerless(
        [
          {
            key: 'More',
            kind: 'submenu',
            positioner: { dir },
            trigger: { openOnHover: false },
            items: [{ key: 'Leaf' }],
          },
        ],
        { root: { onOpenChange: changes(log) }, portal: { keepMounted }, positioner: { dir } },
      );
      const root = await opened();
      item('More').focus();
      await userEvent.keyboard(dir === 'rtl' ? '{ArrowLeft}' : '{ArrowRight}');
      await waitFor(() => expect(active()).toBe(item('Leaf')));
      expect(log).toEqual([]);
      await userEvent.keyboard('{Escape}');
      await closed('More');
      expect(active()).toBe(item('More'));
      expect(log).toEqual([]);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(log).toEqual(['false escape-key']));
      await waitFor(() => expect(root.isConnected).toBe(keepMounted));
      if (keepMounted) expect(root).toHaveAttribute('hidden');
    },
  );

  test.each([false, true])(
    'a menu at an outside anchor opens again with its submenu, and the focus goes back to the anchor: keepMounted %s',
    async (keepMounted) => {
      const log: string[] = [];
      const positioner = reactive<Props>({ anchor: null });
      const root = reactive<Props>({ open: false, modal: false });
      root.onOpenChange = (open: boolean, details: MenuRootChangeEventDetails) => {
        log.push(`${open} ${details.reason}`);
        if (!open) {
          root.open = false;
          positioner.anchor = null;
        }
      };
      await mountTree({
        provider: false,
        trigger: false,
        input: false,
        list: false,
        root,
        positioner,
        portal: { keepMounted },
        entries: [
          {
            key: 'More',
            kind: 'submenu',
            trigger: { openOnHover: false },
            items: [{ key: 'Nested' }],
          },
        ],
      });
      const anchor = document.getElementById('outside')!;
      anchor.addEventListener('click', () => {
        positioner.anchor = anchor;
        root.open = true;
      });
      for (let round = 0; round < 2; round += 1) {
        // A press gives no focus to a button in WebKit on macOS, so a key presses the anchor.
        anchor.focus();
        await userEvent.keyboard('{Enter}');
        await opened();
        item('More').focus();
        await userEvent.keyboard('{ArrowRight}');
        await waitFor(() => expect(active()).toBe(item('Nested')));
        expect(log).toEqual([]);
        await userEvent.click(item('Nested'));
        await waitFor(() => expect(popup()?.checkVisibility() ?? false).toBe(false));
        expect(log).toEqual(['false item-press']);
        await waitFor(() => expect(active()).toBe(anchor));
        log.length = 0;
      }
    },
  );

  test.each(['click', 'hover'] as const)(
    'a %s on a second submenu closes the first one and leaves the menu open',
    async (method) => {
      const log: string[] = [];
      const first: string[] = [];
      const openOnHover = method === 'hover';
      await mountTriggerless(
        [
          {
            key: 'First',
            kind: 'submenu',
            root: { onOpenChange: changes(first) },
            trigger: { openOnHover, delay: 0 },
            items: [{ key: 'first-item' }],
          },
          {
            key: 'Second',
            kind: 'submenu',
            trigger: { openOnHover, delay: 0 },
            items: [{ key: 'second-item' }],
          },
        ],
        { root: { onOpenChange: changes(log) } },
      );
      await opened();
      await userEvent[method](item('First'));
      await opened('First');
      first.length = 0;
      await userEvent[method](item('Second'));
      await opened('Second');
      await closed('First');
      expect(first).toHaveLength(1);
      expect(first[0]).toMatch(
        openOnHover ? /^false (trigger-hover|sibling-open)$/ : /^false sibling-open$/,
      );
      expect(log).toEqual([]);
    },
  );

  test('a submenu that is open at the mount opens with the menu, and the menu reports no change', async () => {
    const log: string[] = [];
    await mountTriggerless(
      [{ key: 'More', kind: 'submenu', root: { defaultOpen: true }, items: [{ key: 'Nested' }] }],
      { root: { onOpenChange: changes(log) } },
    );
    await opened();
    await opened('More');
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);
    expect(log).toEqual([]);
  });
});
