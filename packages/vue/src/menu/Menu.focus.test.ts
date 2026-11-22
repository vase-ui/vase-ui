import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import MenuItemOpensDialog from '../../test/fixtures/MenuItemOpensDialog.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import type { MenuEntry } from '../../test/fixtures/menuEntries';
import { inSubmenu, input, mountTree, opened as openedPopup } from '../../test/menuFilter';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const active = () => document.activeElement as HTMLElement | null;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function mountMenu(setup: Props = {}) {
  const result = mount(MenuParts, setup);
  await nextTick();
  const trigger = result.root.querySelector<HTMLElement>('[data-testid="trigger"]')!;
  return { ...result, trigger };
}

/** The press of a screen reader in Chrome: a mouse press of 1 by 1 pixel with no pressure. */
function pressWithScreenReader(element: Element) {
  const pointer = {
    bubbles: true,
    cancelable: true,
    pointerType: 'mouse',
    width: 1,
    height: 1,
    pressure: 0,
    buttons: 0,
  };
  const mouse = { bubbles: true, cancelable: true, detail: 0 };
  element.dispatchEvent(new PointerEvent('pointerdown', pointer));
  element.dispatchEvent(new MouseEvent('mousedown', mouse));
  element.dispatchEvent(new PointerEvent('pointerup', pointer));
  element.dispatchEvent(new MouseEvent('mouseup', mouse));
  element.dispatchEvent(new MouseEvent('click', mouse));
}

describe('a press of a screen reader', () => {
  test('the focus goes from an item to the alert dialog that it opens, and back to the trigger at its close', async () => {
    mount(MenuItemOpensDialog, { alert: true });
    await nextTick();
    const trigger = byTestId('trigger')!;
    document.getElementById('before')!.focus();
    pressWithScreenReader(trigger);
    await waitFor(() => expect(active()).toBe(item('open')));
    pressWithScreenReader(item('open'));
    await waitFor(() => expect(active()).toBe(byTestId('dialog-button')));
    pressWithScreenReader(byTestId('dialog-button')!);
    await waitFor(() => expect(active()).toBe(trigger));
  });

  test('a press on another trigger of the handle moves the menu there, and the focus stays in the popup', async () => {
    const handle = Menu.createHandle();
    const { trigger } = await mountMenu({
      root: { handle },
      trigger: { handle },
      detached: { handle },
    });
    pressWithScreenReader(trigger);
    await waitFor(() => expect(active()).toBe(item('a')));
    const second = byTestId('detached')!;
    pressWithScreenReader(second);
    await waitFor(() => expect(second).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(active()).toBe(item('a')));
  });

  test.each([false, true])(
    'a press on the trigger of a filterable submenu of a filterable menu gives the focus to its input: kept mounted %s',
    async (keepMounted) => {
      const portal = keepMounted ? { keepMounted: true } : undefined;
      const entries: MenuEntry[] = [
        { key: 'Share' },
        { key: 'More', kind: 'submenu', filter: {}, portal, items: [{ key: 'Alpha' }] },
      ];
      await mountTree({ root: { defaultOpen: true }, portal, entries });
      await openedPopup();
      await waitFor(() => expect(active()).toBe(input()));
      pressWithScreenReader(item('More'));
      await inSubmenu('More');
      await frame();
      await frame();
      expect(active()).toBe(input('More'));
    },
  );
});

describe('the focus at the close', () => {
  test('Escape gives the focus to the trigger also when the positioner gets `mouseleave` while the popup leaves', async () => {
    const { trigger } = await mountTree({
      provider: false,
      input: false,
      list: false,
      transition: true,
      entries: [{ key: 'one' }, { key: 'two' }],
    });
    await userEvent.click(trigger);
    await openedPopup();
    await userEvent.hover(item('one'));
    await waitFor(() => expect(active()).toBe(item('one')));
    await userEvent.keyboard('{Escape}');
    byTestId('positioner')!.dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: document.body }),
    );
    await waitFor(() => expect(popup()).toHaveClass('menu-filter-fade-leave-active'));
    await waitFor(() => expect(active()).toBe(trigger));
  });

  test('a menu that a button opened through `open` gives the focus back to that button', async () => {
    const root = reactive<Props>({ open: false, triggerId: 'menu-trigger' });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    await mountMenu({ root, trigger: { id: 'menu-trigger' } });
    // A press gives no focus to a button in WebKit on macOS, so a key presses the opener.
    const opener = document.getElementById('outside')!;
    opener.addEventListener('click', () => (root.open = true));
    opener.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(popup()).not.toBe(null));
    await waitFor(() => expect(active()).not.toBe(opener));
    await userEvent.click(item('a'));
    await waitFor(() => expect(popup()).toBe(null));
    expect(active()).toBe(opener);
  });

  test('a hover that opens a kept submenu again leaves the focus outside the menu', async () => {
    await mountMenu({
      root: { open: true, modal: false, highlightItemOnHover: false },
      submenu: { trigger: { delay: 0 }, portal: { keepMounted: true } },
    });
    await waitFor(() => expect(active()).toBe(popup()));
    const trigger = item('sub');
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail: 1 }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail: 1 }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    const outside = document.getElementById('outside')!;
    outside.focus();
    await userEvent.hover(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    await frame();
    expect(active()).toBe(outside);
  });

  test('Shift+Tab in a submenu in a portal to a shadow root closes it and gives the focus to its trigger', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());
    const { trigger } = await mountMenu({
      items: [],
      submenu: { portal: { to: shadowRoot } },
      sibling: {},
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('sub')));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(shadowRoot.activeElement?.getAttribute('data-key')).toBe('s1'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(shadowRoot.querySelector('[data-testid="sub-popup"]')).toBe(null));
    await waitFor(() => expect(active()).toBe(item('sub')));
  });
});

describe('the focus out', () => {
  test('a control in a shadow root in the popup takes the focus, and the menu stays open', async () => {
    const { trigger } = await mountMenu();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()?.getAttribute('role')).toBe('menuitem'));
    const host = popup()!.appendChild(document.createElement('div'));
    const control = host
      .attachShadow({ mode: 'open' })
      .appendChild(document.createElement('button'));
    control.focus();
    await new Promise((resolve) => setTimeout(resolve));
    await frame();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(host.shadowRoot!.activeElement).toBe(control);
  });
});

describe('the typed string', () => {
  test('a letter with a diacritic goes to the next item that starts with it', async () => {
    await mountMenu({
      root: { open: true },
      items: [{ key: 'Aa' }, { key: 'ąa' }, { key: 'ąb' }, { key: 'ąc' }],
    });
    await waitFor(() => expect(active()).toBe(popup()));
    item('Aa').focus();
    // The keyboard of Playwright has no key for `ą`, and it inserts the text with no `keydown`.
    item('Aa').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ą', bubbles: true, cancelable: true }),
    );
    await waitFor(() => expect(active()).toBe(item('ąa')));
    expect(item('ąa')).toHaveAttribute('data-highlighted');
  });
});
