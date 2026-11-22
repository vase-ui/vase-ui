import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Menu, type MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import MenuHandlePayloads from '../../test/fixtures/MenuHandlePayloads.vue';
import MenuItemOpensDialog from '../../test/fixtures/MenuItemOpensDialog.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { mountTree } from '../../test/menuFilter';
import { clientCenter, holdPress, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';

async function mountMenu(setup: Props = {}) {
  const result = mount(MenuParts, setup);
  await nextTick();
  const trigger = result.root.querySelector<HTMLElement>('[data-testid="trigger"]')!;
  return { ...result, trigger };
}

function centerOf(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
}

describe('the hover', () => {
  test('a second move on the same item of the parent does not start the close delay of the submenu again', async () => {
    let closedAt = 0;
    let highlightedAt = 0;
    const { trigger } = await mountMenu({
      root: {
        onItemHighlighted: (element: HTMLElement | undefined) => {
          if (element?.getAttribute('data-key') === 'a') highlightedAt ||= performance.now();
        },
      },
      trigger: { openOnHover: true, delay: 0 },
      submenu: {
        root: { onOpenChange: (open: boolean) => (closedAt = open ? 0 : performance.now()) },
        trigger: { delay: 0, closeDelay: 600 },
      },
    });
    await userEvent.hover(trigger);
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.hover(item('sub'));
    await waitFor(() => expect(byTestId('sub-popup')).not.toBe(null));
    // The second point is out of the triangle toward the submenu, so the item takes the highlight.
    await userEvent.hover(item('a'));
    await userEvent.hover(item('a'), { position: { x: 2, y: 2 } });
    await waitFor(() => expect(highlightedAt).not.toBe(0));
    await wait(300 - (performance.now() - highlightedAt));
    expect(byTestId('sub-popup')).not.toBe(null);
    await userEvent.hover(item('a'), { position: { x: 6, y: 4 } });
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
    // A second start of the delay would close the submenu 900 ms after the highlight.
    expect(closedAt - highlightedAt).toBeLessThan(800);
  });

  test('a hover that starts on a closed kept submenu still opens it after a sibling opens', async () => {
    const first = reactive<Props>({ open: false });
    first['onUpdate:open'] = (open: boolean) => (first.open = open);
    await mountMenu({
      root: { defaultOpen: true },
      submenu: { root: first, trigger: { openOnHover: false } },
      sibling: { trigger: { delay: 100 }, portal: { keepMounted: true } },
    });
    await waitFor(() => expect(popup()).not.toBe(null));
    expect(byTestId('sibling-popup')).toHaveAttribute('hidden');
    await userEvent.hover(item('sibling'));
    first.open = true;
    await waitFor(() => expect(byTestId('sub-popup')).not.toBe(null));
    await waitFor(() => expect(byTestId('sibling-popup')).not.toHaveAttribute('hidden'));
    expect(item('sibling')).toHaveAttribute('aria-expanded', 'true');
  });

  test('VUE-208: a hover open that a controlled root does not apply reports no close when the pointer leaves', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      root: {
        open: false,
        onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
          log.push(`${open} ${details.reason}`),
      },
      trigger: { openOnHover: true, delay: 0 },
    });
    await userEvent.hover(trigger);
    await waitFor(() => expect(log).toEqual(['true trigger-hover']));
    expect(popup()).toBe(null);
    await userEvent.hover(document.getElementById('outside')!);
    await wait(100);
    expect(log).toEqual(['true trigger-hover']);
  });

  test('a hover open that a listener canceled reports nothing when the pointer leaves', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      root: {
        onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) => {
          log.push(`${open} ${details.reason}`);
          if (details.reason === 'trigger-hover') details.cancel();
        },
      },
      trigger: { openOnHover: true, delay: 0 },
    });
    await userEvent.hover(trigger);
    await waitFor(() => expect(log).toEqual(['true trigger-hover']));
    await userEvent.hover(document.getElementById('outside')!);
    await wait(100);
    expect(log).toEqual(['true trigger-hover']);
  });

  test('a hover again after a hover close, and a press, keep the menu open', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 100 } });
    await userEvent.hover(trigger);
    await waitFor(() => expect(popup()).not.toBe(null));
    await wait(500);
    await userEvent.hover(document.getElementById('outside')!);
    await waitFor(() => expect(popup()).toBe(null));
    await userEvent.hover(trigger);
    await userEvent.click(trigger);
    await wait(150);
    expect(popup()).not.toBe(null);
  });

  test('a hover close after a move to another trigger animates: the popup leaves with no `data-instant`', async () => {
    const handle = Menu.createHandle();
    await mountTree({
      provider: false,
      input: false,
      list: false,
      transition: true,
      root: { handle },
      trigger: { handle, openOnHover: true, delay: 0, style: 'margin: 0 40px' },
      detached: { handle, openOnHover: true, delay: 0 },
      entries: [{ key: 'one' }],
    });
    const trigger = byTestId('trigger')!;
    const second = byTestId('detached')!;
    await userEvent.hover(trigger);
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.hover(second);
    await waitFor(() => expect(second).toHaveAttribute('aria-expanded', 'true'));
    const element = popup()!;
    await userEvent.hover(document.getElementById('outside')!);
    await waitFor(() => expect(element).toHaveClass('menu-filter-fade-leave-active'));
    await wait(100);
    expect(popup()).toBe(element);
    expect(element).not.toHaveAttribute('data-instant');
  });
});

describe('the press', () => {
  test.skipIf(server.browser !== 'chromium')(
    'a touch open of a kept popup that covers the width of the view locks the scroll',
    async () => {
      const { trigger } = await mountMenu({
        portal: { keepMounted: true },
        popup: { style: { width: '100vw' } },
      });
      await touchDrag(centerOf(trigger), centerOf(trigger), 0);
      await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
      await waitFor(() => expect(isScrollLocked()).toBe(true));
    },
  );

  test('a release on an item after a press on the trigger opens a dialog that stays open', async () => {
    const { exposed } = mount(MenuItemOpensDialog, { portal: { keepMounted: true } });
    await nextTick();
    const { release } = await holdPress(byTestId('trigger')!);
    await waitFor(() => expect(popup()).not.toBe(null));
    await wait(200);
    await release(centerOf(item('open')));
    await waitFor(() => expect(byTestId('dialog-popup')).not.toBe(null));
    await wait(100);
    expect(byTestId('dialog-popup')).not.toBe(null);
    expect(exposed.changes).toEqual([]);
  });

  test('a press on a second trigger while the closed popup leaves gives the open to that trigger', async () => {
    const handle = Menu.createHandle();
    const root = reactive<Props>({ handle, open: false });
    let deferred: boolean | undefined;
    let defer = false;
    root.onOpenChange = (open: boolean) => {
      if (defer) deferred = open;
      else root.open = open;
    };
    const { trigger } = await mountMenu({
      root,
      trigger: { handle },
      detached: { handle },
      portal: { keepMounted: true },
    });
    await userEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    root.open = false;
    await nextTick();
    defer = true;
    const second = byTestId('detached')!;
    await userEvent.click(second);
    await waitFor(() => expect(deferred).toBe(true));
    root.open = true;
    await nextTick();
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('a handle with payloads', () => {
  test('each trigger, an outside button through the props and an outside button through the handle open the menu with the payload of the trigger', async () => {
    mount(MenuHandlePayloads);
    await nextTick();
    const button = (name: string) =>
      [...document.querySelectorAll('button')].find((each) => each.textContent?.trim() === name)!;
    const openWith = async (text: string) => {
      await waitFor(() => expect(popup()).not.toBe(null));
      await waitFor(() => expect(item('item')).toHaveTextContent(text));
    };
    const closedMenu = () => waitFor(() => expect(popup()).toBe(null));
    for (const name of ['Library', 'Playback', 'Sharing']) {
      await userEvent.click(button(name));
      await openWith(name);
      expect(button(name)).toHaveAttribute('aria-expanded', 'true');
      await userEvent.click(item('item'));
      await closedMenu();
    }
    await userEvent.click(button('Library'));
    await openWith('Library');
    await userEvent.click(button('Sharing'));
    await openWith('Sharing');
    await userEvent.click(button('Sharing'));
    await closedMenu();
    await userEvent.click(byTestId('external')!);
    await openWith('Playback');
    await userEvent.keyboard('{Escape}');
    await closedMenu();
    await userEvent.click(byTestId('via-handle')!);
    await openWith('Playback');
    await userEvent.click(item('item'));
    await closedMenu();
  });
});
