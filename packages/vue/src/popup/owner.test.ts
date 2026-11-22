import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PopupOwners from '../../test/fixtures/PopupOwners.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const owners = () => [...document.querySelectorAll<HTMLElement>('[aria-owns]')];
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

async function mountPopover(props: Record<string, unknown>) {
  const { root } = mount(PopoverParts, props);
  await nextTick();
  return root;
}

async function waitForPopup(id: string) {
  await waitFor(() => expect(document.getElementById(id)).not.toBe(null));
  await nextTick();
}

describe('the element that owns the popup', () => {
  test('an open popover that is not modal has one at the place of its portal, with the id of the popup and no role', async () => {
    const root = await mountPopover({ root: { defaultOpen: true }, popup: { id: 'popup' } });
    await waitForPopup('popup');
    expect(owners()).toHaveLength(1);
    const [owner] = owners();
    expect(owner).toHaveAttribute('aria-owns', 'popup');
    expect(owner).not.toHaveAttribute('role');
    expect(owner).not.toHaveAttribute('aria-hidden');
    expect(owner!.parentElement).toBe(root);
    expect(root.contains(document.getElementById('popup'))).toBe(false);
  });

  test('follows a new id of the popup', async () => {
    const popup = reactive<Record<string, unknown>>({ id: 'first' });
    await mountPopover({ root: { defaultOpen: true }, popup });
    await waitForPopup('first');
    popup.id = 'second';
    await waitFor(() => expect(owners()[0]).toHaveAttribute('aria-owns', 'second'));
  });

  test.each([
    { name: 'a modal popover with a close part', root: { modal: true }, close: {} },
    { name: 'a popover that traps the focus', root: { modal: 'trap-focus' }, close: {} },
    { name: 'a disabled portal', portal: { disabled: true } },
  ])('$name has none', async ({ root, portal, close }) => {
    await mountPopover({
      root: { defaultOpen: true, ...root },
      portal,
      close,
      popup: { id: 'popup' },
    });
    await waitForPopup('popup');
    expect(owners()).toEqual([]);
  });

  test('a modal popover with no close part has one, because the focus can leave it', async () => {
    await mountPopover({ root: { defaultOpen: true, modal: true }, popup: { id: 'popup' } });
    await waitForPopup('popup');
    expect(owners()).toHaveLength(1);
  });

  test('a closed popover has none, also with keepMounted', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      portal: { keepMounted: true },
      popup: { id: 'popup' },
    });
    await waitForPopup('popup');
    expect(owners()).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.getElementById('popup')).toHaveAttribute('hidden'));
    expect(owners()).toEqual([]);
  });

  test('a submenu has one with the role group in the menu; the root menu has one with no role', async () => {
    mount(PopupOwners, { scene: 'menu' });
    await userEvent.click(byTestId('trigger'));
    await waitForPopup('menu-popup');
    expect(owners().map((owner) => owner.getAttribute('role'))).toEqual([null]);
    await userEvent.click(byTestId('submenu-trigger'));
    await waitForPopup('submenu-popup');
    const submenuOwner = document.querySelector('[aria-owns="submenu-popup"]')!;
    expect(submenuOwner).toHaveAttribute('role', 'group');
    expect(document.getElementById('menu-popup')!.contains(submenuOwner)).toBe(true);
    expect(document.querySelector('[aria-owns="menu-popup"]')).not.toHaveAttribute('role');
  });

  test('a menu in a menubar has one with the role group; a menu whose trigger is in the menubar and whose root is not has one with no role', async () => {
    mount(PopupOwners, { scene: 'menubar' });
    await userEvent.click(byTestId('edit'));
    await waitForPopup('edit-popup');
    const editOwner = document.querySelector('[aria-owns="edit-popup"]')!;
    expect(editOwner).not.toHaveAttribute('role');
    expect(byTestId('bar').contains(editOwner)).toBe(false);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.getElementById('edit-popup')).toBe(null));
    await userEvent.click(byTestId('file'));
    await waitForPopup('file-popup');
    const fileOwner = document.querySelector('[aria-owns="file-popup"]')!;
    expect(fileOwner).toHaveAttribute('role', 'group');
    expect(byTestId('bar').contains(fileOwner)).toBe(true);
  });

  test('an open select has one with no role', async () => {
    mount(PopupOwners, { scene: 'select' });
    await userEvent.click(byTestId('trigger'));
    await waitForPopup('select-popup');
    expect(document.querySelector('[aria-owns="select-popup"]')).not.toHaveAttribute('role');
  });

  test('an open combobox has one when its input is in the popup, and none when the input is outside', async () => {
    const { unmount } = mount(ComboboxParts, {
      inputInPopup: true,
      root: { defaultOpen: true },
      popup: { id: 'combobox-popup' },
    });
    await waitForPopup('combobox-popup');
    expect(owners().map((owner) => owner.getAttribute('aria-owns'))).toEqual(['combobox-popup']);
    unmount();
    mount(ComboboxParts, { root: { defaultOpen: true }, popup: { id: 'combobox-popup' } });
    await waitForPopup('combobox-popup');
    expect(owners()).toEqual([]);
  });

  test('takes no focus: Tab goes from the trigger into the popup, and out of it after the trigger', async () => {
    await mountPopover({ popup: { id: 'popup', initialFocus: false } });
    const trigger = document.querySelector<HTMLElement>('[data-key="t"]')!;
    await userEvent.click(trigger);
    await waitForPopup('popup');
    expect(owners()).toHaveLength(1);
    trigger.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('second'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(document.getElementById('after'));
  });
});
