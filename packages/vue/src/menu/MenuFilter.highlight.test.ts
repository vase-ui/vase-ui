import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MenuFilterInDialog from '../../test/fixtures/MenuFilterInDialog.vue';
import type { MenuEntry } from '../../test/fixtures/menuEntries';
import {
  active,
  activeDescendant,
  byTestId,
  closed,
  highlighted,
  input,
  item,
  mountTree,
  opened,
  openWithKey,
  popup,
  shown,
} from '../../test/menuFilter';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const entries = (...keys: string[]): MenuEntry[] => keys.map((key) => ({ key }));

async function focusInput() {
  await opened();
  input()!.focus();
  await waitFor(() => expect(active()).toBe(input()));
}

describe('autoHighlight', () => {
  test('a press opens the menu with the input focus-visible: it has `data-highlighted`', async () => {
    const { trigger } = await mountTree({ entries: entries('Rename') });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    expect(input()!.matches(':focus-visible')).toBe(true);
    expect(input()).toHaveAttribute('data-highlighted');
  });

  test('`always`: a controlled query that hides the highlighted item moves `aria-activedescendant` to the id of the developer on the first shown item', async () => {
    const provider = reactive<Props>({ autoHighlight: 'always', modelValue: '' });
    await mountTree({
      provider,
      root: { open: true },
      entries: [
        { key: 'Apple', attrs: { id: 'apple-item' } },
        { key: 'Banana', attrs: { id: 'banana-item' } },
      ],
    });
    await waitFor(() => expect(input()).toHaveAttribute('aria-activedescendant', 'apple-item'));
    provider.modelValue = 'ban';
    await waitFor(() => expect(input()).toHaveAttribute('aria-activedescendant', 'banana-item'));
    expect(shown()).toEqual(['Banana']);
  });

  test.each([true, 'always'] as const)(
    'a key that does not change the trimmed query keeps the highlight: autoHighlight %s',
    async (autoHighlight) => {
      await mountTree({
        provider: { autoHighlight },
        root: { open: true },
        entries: entries('Google Calendar', 'Google Chrome'),
      });
      await focusInput();
      await userEvent.keyboard('Google');
      await waitFor(() => expect(highlighted()).toBe('Google Calendar'));
      await userEvent.keyboard(' ');
      expect(input()!.value).toBe('Google ');
      await nextTick();
      expect(highlighted()).toBe('Google Calendar');
      expect(activeDescendant()).toBe('Google Calendar');
    },
  );

  test.each([true, 'always'] as const)(
    'the arrow keys wrap at an end and do not give the highlight to the input: autoHighlight %s',
    async (autoHighlight) => {
      await mountTree({
        provider: { autoHighlight },
        root: { open: true },
        entries: entries('Rename', 'Delete'),
      });
      await focusInput();
      if (autoHighlight === true) await userEvent.keyboard('e');
      await waitFor(() => expect(highlighted()).toBe('Rename'));
      await userEvent.keyboard('{ArrowUp}');
      expect(highlighted()).toBe('Delete');
      expect(activeDescendant()).toBe('Delete');
      await userEvent.keyboard('{ArrowDown}');
      expect(highlighted()).toBe('Rename');
      expect(activeDescendant()).toBe('Rename');
    },
  );

  test('`always` in a menu that opens in a dialog highlights the first item', async () => {
    mount(MenuFilterInDialog);
    await userEvent.click(byTestId('dialog-trigger')!);
    await opened();
    await waitFor(() => expect(highlighted()).toBe('linear'));
    expect(activeDescendant()).toBe('linear');
  });

  test('Clear removes a highlight that a key moved', async () => {
    await mountTree({
      provider: { autoHighlight: true },
      root: { open: true },
      clear: { 'aria-label': 'Clear filter' },
      entries: entries('Rename', 'Delete'),
    });
    await focusInput();
    await userEvent.keyboard('e{ArrowDown}');
    expect(highlighted()).toBe('Delete');
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(input()).not.toHaveAttribute('aria-activedescendant'));
    expect(highlighted()).toBe(null);
  });

  test('the keys go on from the highlight of `autoHighlight`, and Enter clicks the item', async () => {
    const clicks: string[] = [];
    await mountTree({
      provider: { autoHighlight: true },
      root: { open: true },
      entries: [
        { key: 'Duplicate' },
        { key: 'Delete', attrs: { onClick: () => clicks.push('Delete') } },
      ],
    });
    await focusInput();
    await userEvent.keyboard('d');
    await waitFor(() => expect(highlighted()).toBe('Duplicate'));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(clicks).toEqual(['Delete']);
  });

  test('`always` with a filter of the developer: the label of `itemHighlighted` follows the keys, and Enter clicks the item one time', async () => {
    const labels: (string | undefined)[] = [];
    const clicks: string[] = [];
    await mountTree({
      provider: {
        autoHighlight: 'always',
        filter: (text: string, query: string) => text.includes(query),
      },
      root: {
        defaultOpen: true,
        onItemHighlighted: (_: unknown, details: { label: string | undefined }) =>
          labels.push(details.label),
      },
      entries: ['Rename', 'Delete'].map((key) => ({
        key,
        attrs: { onClick: () => clicks.push(key) },
      })),
    });
    await waitFor(() => expect(active()).toBe(input()));
    await waitFor(() => expect(labels.at(-1)).toBe('Rename'));
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Delete');
    expect(labels.at(-1)).toBe('Delete');
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual(['Delete']);
  });

  test('`always`: a pointer highlight stays when the pointer leaves the item', async () => {
    await mountTree({
      provider: { autoHighlight: 'always' },
      root: { open: true },
      entries: entries('Rename', 'Delete'),
    });
    await opened();
    await userEvent.hover(item('Delete'));
    await waitFor(() => expect(highlighted()).toBe('Delete'));
    await userEvent.unhover(item('Delete'));
    await nextTick();
    expect(highlighted()).toBe('Delete');
  });

  test('`always`: a change of the text of an item keeps the highlight', async () => {
    const list = reactive<MenuEntry[]>([
      { key: 'inbox', text: 'Inbox (1)' },
      { key: 'Archive' },
      { key: 'Delete' },
    ]);
    await mountTree({
      provider: { autoHighlight: 'always' },
      root: { open: true },
      entries: list,
    });
    await focusInput();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe('Delete');
    list[0]!.text = 'Inbox (2)';
    await waitFor(() => expect(item('inbox')).toHaveTextContent('Inbox (2)'));
    expect(highlighted()).toBe('Delete');
    expect(activeDescendant()).toBe('Delete');
  });

  test('the highlight of `autoHighlight` stays on the item that a query moves away from the pointer', async () => {
    await mountTree({
      provider: { autoHighlight: true },
      root: { open: true },
      entries: entries('Rename', 'Delete'),
    });
    await focusInput();
    await userEvent.keyboard('e');
    await userEvent.hover(item('Delete'));
    await waitFor(() => expect(activeDescendant()).toBe('Delete'));
    await userEvent.keyboard('l');
    await waitFor(() => expect(shown()).toEqual(['Delete']));
    item('Delete').dispatchEvent(
      new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: false }),
    );
    await nextTick();
    expect(activeDescendant()).toBe('Delete');
  });

  test('`always` in a filterable submenu that is open at the mount highlights its first item, and the keys move it', async () => {
    await mountTree({
      provider: false,
      root: { open: true },
      input: false,
      list: false,
      entries: [
        {
          key: 'move',
          kind: 'submenu',
          filter: { autoHighlight: 'always' },
          root: { defaultOpen: true },
          items: entries('Documents', 'Downloads'),
        },
      ],
    });
    await opened('move');
    await waitFor(() => expect(highlighted('move')).toBe('Documents'));
    expect(activeDescendant('move')).toBe('Documents');
    // A submenu that opens with no input of the user leaves the focus in the parent.
    expect(active()).not.toBe(input('move'));
    input('move')!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(highlighted('move')).toBe('Downloads');
    expect(activeDescendant('move')).toBe('Downloads');
  });

  test('a press on the trigger closes the menu with no highlight while the popup leaves', async () => {
    const { trigger } = await mountTree({ transition: true, entries: entries('Rename') });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    expect(highlighted()).toBe(null);
    trigger.focus();
    await nextTick();
    expect(highlighted()).toBe(null);
    await userEvent.click(trigger);
    await waitFor(() => expect(popup()).toHaveClass('menu-filter-fade-leave-active'));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(highlighted()).toBe(null);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(highlighted()).toBe(null);
  });

  test('Left, Home and Right keep moving the caret while `autoHighlight` highlights an item', async () => {
    await mountTree({
      provider: { autoHighlight: true },
      root: { open: true },
      entries: entries('Rename', 'Remove'),
    });
    await focusInput();
    await userEvent.keyboard('rem');
    await waitFor(() => expect(activeDescendant()).toBe('Remove'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(input()!.selectionStart).toBe(2);
    // Home moves no caret in a text field of macOS, so the case reads that it keeps its default.
    let home: KeyboardEvent | undefined;
    input()!.addEventListener('keydown', (event) => (home ??= event));
    await userEvent.keyboard('{Home}');
    expect(home?.defaultPrevented).toBe(false);
    input()!.setSelectionRange(0, 0);
    await userEvent.keyboard('{ArrowRight}');
    expect(input()!.selectionStart).toBe(1);
    expect(activeDescendant()).toBe('Remove');
  });

  test('`always`: the focus that comes back to the input from an item keeps the highlight', async () => {
    await mountTree({
      provider: { autoHighlight: 'always' },
      root: { defaultOpen: true },
      entries: entries('Rename', 'Delete'),
    });
    await opened();
    await waitFor(() => expect(activeDescendant()).toBe('Rename'));
    item('Rename').focus();
    input()!.focus();
    await nextTick();
    expect(activeDescendant()).toBe('Rename');
  });
});

describe('the first highlight', () => {
  test('a menu that is open at the mount gives the focus to the input', async () => {
    await mountTree({ root: { defaultOpen: true }, entries: entries('Rename', 'Delete') });
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('a hover open does not give the focus to the input', async () => {
    const focuses: string[] = [];
    const { trigger } = await mountTree({
      trigger: { openOnHover: true, delay: 0 },
      input: { onFocus: () => focuses.push('input') },
      entries: entries('Rename', 'Delete'),
    });
    await userEvent.hover(trigger);
    await opened();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(active()).not.toBe(input());
    expect(focuses).toEqual([]);
  });

  test('a controlled open after a key open highlights no item', async () => {
    const root = reactive<Props>({ open: undefined });
    const { trigger } = await mountTree({ root, entries: entries('Rename', 'Delete') });
    await openWithKey(trigger, '{ArrowDown}');
    await waitFor(() => expect(activeDescendant()).toBe('Rename'));
    root.open = false;
    await closed();
    root.open = true;
    await opened();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('the list', () => {
  test('the list has `tabindex` -1 and no `aria-hidden`; the items are not in the tab order', async () => {
    await mountTree({ root: { open: true }, entries: entries('Apple', 'Banana') });
    await opened();
    const list = byTestId('list')!;
    expect(list).not.toHaveAttribute('aria-hidden');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(item('Apple')).toHaveAttribute('tabindex', '-1');
    expect(item('Apple')).not.toHaveAttribute('aria-expanded');
  });

  test('an arrow key on a list that has the focus moves the highlight from the input, and prevents the scroll', async () => {
    await mountTree({ root: { defaultOpen: true }, entries: entries('Apple', 'Banana') });
    await opened();
    const list = byTestId('list')!;
    input()!.blur();
    list.focus();
    const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    list.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    await waitFor(() => expect(activeDescendant()).toBe('Apple'));
    expect(active()).toBe(input());
  });

  test('Enter on a list that has the focus clicks the highlighted item', async () => {
    const clicks: string[] = [];
    await mountTree({
      root: { defaultOpen: true },
      entries: [
        { key: 'Apple', attrs: { onClick: () => clicks.push('Apple') } },
        { key: 'Banana' },
      ],
    });
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Apple');
    const list = byTestId('list')!;
    input()!.blur();
    list.focus();
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(clicks).toEqual(['Apple']);
  });

  test('Escape on a list that has the focus closes the menu', async () => {
    await mountTree({ root: { defaultOpen: true }, entries: entries('Apple') });
    await opened();
    const list = byTestId('list')!;
    input()!.blur();
    list.focus();
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  test('a character on a list that has the focus goes to the input with its default', async () => {
    await mountTree({ root: { defaultOpen: true }, entries: entries('Apple') });
    await opened();
    const list = byTestId('list')!;
    input()!.blur();
    list.focus();
    const key = new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true });
    list.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    expect(active()).toBe(input());
  });

  test('`aria-activedescendant` names the new `id` of an item', async () => {
    const list = reactive<MenuEntry[]>([
      { key: 'First', attrs: { id: 'first-item' } },
      { key: 'Second', attrs: { id: 'old-id' } },
    ]);
    await mountTree({
      provider: { autoHighlight: 'always' },
      root: { defaultOpen: true },
      entries: list,
    });
    await waitFor(() => expect(input()).toHaveAttribute('aria-activedescendant', 'first-item'));
    input()!.focus();
    list[1]!.attrs = { id: 'new-id' };
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(input()).toHaveAttribute('aria-activedescendant', 'new-id'));
  });

  test('a horizontal list has `aria-orientation`, the dialog has none, and Right moves the highlight', async () => {
    await mountTree({
      provider: { autoHighlight: 'always' },
      root: { defaultOpen: true, orientation: 'horizontal' },
      entries: entries('First', 'Second'),
    });
    await opened();
    expect(byTestId('list')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(popup()).not.toHaveAttribute('aria-orientation');
    await waitFor(() => expect(activeDescendant()).toBe('First'));
    input()!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(activeDescendant()).toBe('Second');
  });

  test('a horizontal list: Up in the input highlights the last item', async () => {
    await mountTree({
      root: { defaultOpen: true, orientation: 'horizontal' },
      entries: entries('Alpha', 'Apple', 'Beta'),
    });
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(activeDescendant()).toBe('Beta');
  });

  test('a horizontal list: Down on the trigger opens the menu with the first item highlighted', async () => {
    const { trigger } = await mountTree({
      root: { orientation: 'horizontal' },
      entries: entries('Alpha', 'Apple', 'Beta'),
    });
    await openWithKey(trigger, '{ArrowDown}');
    await waitFor(() => expect(activeDescendant()).toBe('Alpha'));
  });
});
