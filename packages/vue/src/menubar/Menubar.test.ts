import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import MenubarParts from '../../test/fixtures/MenubarParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { movePointerThrough, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popupOf = (key: string) => byTestId(`${key}-popup`);
const element = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const active = () => document.activeElement as HTMLElement | null;
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';

async function mountBar(setup: Props = {}) {
  const result = mount(MenubarParts, setup);
  await nextTick();
  return result;
}

/**
 * Props that write each change of a menu in `log` as `<key of the trigger> <open> <reason>`: `root`
 * for the one root of a form, and `roots` for the root of each trigger.
 */
function logged(log: string[]) {
  const onOpenChange = (open: boolean, details: MenuRootChangeEventDetails) =>
    log.push(`${details.trigger?.getAttribute('data-key')} ${open} ${details.reason}`);
  const roots: Record<string, Props> = {};
  for (const key of ['file', 'edit', 'view']) roots[key] = reactive({ onOpenChange });
  return { root: reactive<Props>({ onOpenChange }), roots };
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe.for([
  { form: 'contained', name: 'a root around each trigger' },
  { form: 'multiple', name: 'one root around the three triggers' },
  { form: 'detached', name: 'one root outside the bar, whose handle each trigger has' },
] as const)('a bar with $name', ({ form }) => {
  const oneRoot = form !== 'contained';
  const mountForm = (setup: Props = {}) => mountBar({ form, ...setup });

  test('is a menubar with one tab stop; its triggers are menu items; the focus opens no menu', async () => {
    await mountForm();
    const bar = byTestId('bar')!;
    expect(bar).toHaveAttribute('role', 'menubar');
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    for (const key of ['file', 'edit', 'view']) {
      expect(element(key)).toHaveAttribute('role', 'menuitem');
      expect(element(key)).toHaveAttribute('aria-haspopup', 'menu');
    }
    expect(element('file')).toHaveAttribute('tabindex', '0');
    expect(element('edit')).toHaveAttribute('tabindex', '-1');
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(element('file'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('file')).toBe(null);
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(element('edit'));
    expect(element('edit')).toHaveAttribute('tabindex', '0');
    expect(element('file')).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(active()).toBe(element('view'));
    await userEvent.keyboard('{Home}');
    expect(active()).toBe(element('file'));
    await userEvent.keyboard('{End}');
    expect(active()).toBe(element('view'));
    await userEvent.keyboard('{Tab}');
    expect(active()?.id).toBe('after');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(element('view'));
    expect(popupOf('view')).toBe(null);
  });

  test('a disabled bar disables each trigger, is no tab stop, and opens no menu', async () => {
    await mountForm({ bar: { disabled: true } });
    for (const key of ['file', 'edit', 'view']) expect(element(key)).toBeDisabled();
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()?.id).toBe('after');
    await userEvent.click(element('file'), { force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('file')).toBe(null);
  });

  test('Space opens a menu, and Escape closes it and gives the focus back to its trigger', async () => {
    await mountForm();
    element('file').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(active()).toBe(element('file-1')));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(active()).toBe(element('file'));
  });

  test('ArrowLeft in a submenu closes it and gives the focus to its trigger; ArrowRight in a submenu closes each menu and opens the next menu of the bar', async () => {
    const log: string[] = [];
    await mountForm({ ...logged(log), submenus: true });
    element('file').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(element('file-1')));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(active()).toBe(element('share'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(element('share-1')));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(byTestId('share-popup')).toBe(null));
    expect(active()).toBe(element('share'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(element('share-1')));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(byTestId('share-popup')).toBe(null);
    expect(log.at(-1)).toBe('edit true list-navigation');
  });

  test('a pointer move on another trigger opens its menu with one openChange, and a menu of another root closes with `sibling-open` (VUE-67, VUE-85)', async () => {
    const log: string[] = [];
    await mountForm(logged(log));
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(log).toEqual([
      'file true trigger-press',
      'edit true trigger-hover',
      ...(oneRoot ? [] : ['file false sibling-open']),
    ]);
    expect(popupOf('edit')).toHaveAttribute('data-instant', 'group');
    await waitFor(() => expect(active()).toBe(popupOf('edit')));
    // The new menu stays open after the pointer leaves.
    await userEvent.pointer({ coords: { x: 5, y: 400 } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('edit')).not.toBe(null);
  });

  test('an arrow key of the bar that no item used closes the menu and opens the next one', async () => {
    const log: string[] = [];
    await mountForm(logged(log));
    element('file').focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(element('file-1')));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(active()).toBe(popupOf('edit')));
    expect(popupOf('file')).toBe(null);
    expect(log).toEqual([
      'file true list-navigation',
      'file false list-navigation',
      'edit true list-navigation',
    ]);
    expect(element('edit')).toHaveAttribute('tabindex', '0');
  });

  test('after a press opens a menu, the arrow keys move in the menu and to the next menu of the bar', async () => {
    await mountForm();
    await userEvent.click(element('file'));
    await waitFor(() => expect(active()).toBe(popupOf('file')));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(element('file-1'));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(element('file-2'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    expect(popupOf('file')).toBe(null);
  });

  test('a hover opens no menu while no menu of the bar is open; a hover on another trigger while a submenu is open closes each menu and opens the other one', async () => {
    await mountForm({ submenus: true });
    await userEvent.hover(element('file'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('file')).toBe(null);
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('share'));
    await waitFor(() => expect(byTestId('share-popup')).not.toBe(null));
    await userEvent.hover(element('share-1'));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(byTestId('share-popup')).toBe(null);
    await userEvent.hover(element('view'));
    await waitFor(() => expect(popupOf('view')).not.toBe(null));
    expect(popupOf('edit')).toBe(null);
  });

  test('a press on a radio item of a submenu keeps the submenu open, in a menu that a press or a hover opened', async () => {
    await mountForm({ submenus: true });
    await userEvent.click(element('view'));
    await waitFor(() => expect(popupOf('view')).not.toBe(null));
    await userEvent.hover(element('layout'));
    await waitFor(() => expect(byTestId('layout-popup')).not.toBe(null));
    await movePointerThrough(centerOf(element('layout')), [centerOf(element('layout-2'))]);
    await userEvent.click(element('layout-2'));
    expect(element('layout-2')).toHaveAttribute('aria-checked', 'true');
    expect(byTestId('layout-popup')).not.toBe(null);
    await userEvent.keyboard('{Escape}{Escape}');
    await waitFor(() => expect(popupOf('view')).toBe(null));
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('view'));
    await waitFor(() => expect(popupOf('view')).not.toBe(null));
    await userEvent.hover(element('layout'));
    await waitFor(() => expect(byTestId('layout-popup')).not.toBe(null));
    await movePointerThrough(centerOf(element('layout')), [centerOf(element('layout-1'))]);
    await userEvent.click(element('layout-1'));
    expect(element('layout-1')).toHaveAttribute('aria-checked', 'true');
    expect(byTestId('layout-popup')).not.toBe(null);
  });

  test('a press on the trigger of an open menu closes it; after a hover moved the open menu and a press closed it, a press and a hover open the menus again', async () => {
    await mountForm();
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await userEvent.click(element('edit'));
    await waitFor(() => expect(popupOf('edit')).toBe(null));
    expect(byTestId('state')).toHaveTextContent('false');
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
  });

  test('with `loopFocus` false, an arrow key at the end of the bar keeps the focus there; with `loopFocus`, it goes to the other end', async () => {
    const bar = reactive<Props>({ loopFocus: false });
    await mountForm({ bar });
    element('view').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(element('view'));
    element('file').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(element('file'));
    bar.loopFocus = true;
    await nextTick();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(element('view'));
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(element('file'));
  });

  test.skipIf(server.browser !== 'chromium')(
    'a tap outside closes each menu, also an open submenu; a second tap on the trigger of a menu that a tap moved closes it',
    async () => {
      await mountForm({ submenus: true });
      await touchDrag(centerOf(element('file')), centerOf(element('file')), 0);
      await waitFor(() => expect(popupOf('file')).not.toBe(null));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await touchDrag(centerOf(element('share')), centerOf(element('share')), 0);
      await waitFor(() => expect(byTestId('share-popup')).not.toBe(null));
      const outside = centerOf(document.getElementById('outside')!);
      await touchDrag(outside, outside, 0);
      await waitFor(() => expect(popupOf('file')).toBe(null));
      expect(byTestId('share-popup')).toBe(null);
      await userEvent.click(element('file'));
      await waitFor(() => expect(popupOf('file')).not.toBe(null));
      await touchDrag(centerOf(element('edit')), centerOf(element('edit')), 0);
      await waitFor(() => expect(popupOf('edit')).not.toBe(null));
      await new Promise((resolve) => setTimeout(resolve, 350));
      await touchDrag(centerOf(element('edit')), centerOf(element('edit')), 0);
      await waitFor(() => expect(popupOf('edit')).toBe(null));
    },
  );

  test('a press outside an open submenu closes each menu and gives no focus to the trigger', async () => {
    await mountForm({ submenus: true });
    element('file').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(byTestId('share-popup')).not.toBe(null));
    await userEvent.pointer({
      coords: { x: window.innerWidth - 10, y: window.innerHeight - 10 },
      keys: '[MouseLeft]',
    });
    await waitFor(() => expect(popupOf('file')).toBe(null));
    await nextTick();
    await nextTick();
    expect(active()).not.toBe(element('file'));
  });
});

describe('a bar with a root around the first trigger and a root outside the bar for the other triggers', () => {
  test('a hover moves the open menu to a trigger of the other root and to another trigger of the same root, and each menu that it opens takes the focus and blocks the page', async () => {
    const log: string[] = [];
    await mountBar({ form: 'mixed', ...logged(log) });
    await userEvent.click(element('file'));
    await waitFor(() => expect(active()).toBe(popupOf('file')));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(active()).toBe(popupOf('edit')));
    expect(popupOf('file')).toBe(null);
    expect(popupOf('edit')).toHaveAttribute('data-instant', 'group');
    await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
    await userEvent.hover(element('view'));
    await waitFor(() => expect(popupOf('view')).not.toBe(null));
    expect(popupOf('view')).toHaveAttribute('data-instant', 'group');
    await userEvent.hover(element('file'));
    await waitFor(() => expect(active()).toBe(popupOf('file')));
    expect(popupOf('view')).toBe(null);
    expect(log).toEqual([
      'file true trigger-press',
      'edit true trigger-hover',
      'file false sibling-open',
      'view true trigger-hover',
      'file true trigger-hover',
      'view false sibling-open',
    ]);
  });

  test('a menu that moves to a trigger of its handle outside the bar is no menu of the bar, until it moves back to a trigger of the bar', async () => {
    await mountBar({ form: 'mixed', help: true, bar: { modal: false }, root: { modal: false } });
    const state = byTestId('state')!;
    await userEvent.click(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    expect(state).toHaveTextContent('true horizontal false');
    await userEvent.click(element('help'));
    await waitFor(() => expect(popupOf('help')).not.toBe(null));
    expect(state).toHaveTextContent('false horizontal false');
    await userEvent.hover(element('file'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('file')).toBe(null);
    await userEvent.click(element('view'));
    await waitFor(() => expect(popupOf('view')).not.toBe(null));
    expect(state).toHaveTextContent('true horizontal false');
    await userEvent.hover(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    expect(popupOf('view')).toBe(null);
  });
});

describe('the bar', () => {
  test('a disabled trigger is out of the keys and is no tab stop', async () => {
    await mountBar({ triggers: { file: { disabled: true } } });
    expect(element('edit')).toHaveAttribute('tabindex', '0');
    element('edit').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(element('view'));
  });

  test('ArrowDown opens the menu with its first item; ArrowUp opens nothing; the slot state says that a menu is open', async () => {
    await mountBar({ bar: { modal: false } });
    expect(byTestId('state')).toHaveTextContent('false horizontal false');
    element('file').focus();
    await userEvent.keyboard('{ArrowUp}');
    await nextTick();
    expect(popupOf('file')).toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(element('file-1')));
    expect(byTestId('state')).toHaveTextContent('true horizontal false');
  });

  test('a vertical bar opens a menu with the arrow key across it', async () => {
    await mountBar({ bar: { orientation: 'vertical' } });
    element('file').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(element('edit'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(element('edit-1')));
    expect(byTestId('edit-positioner')).toHaveAttribute('data-side', 'inline-end');
  });
});

describe('while a menu of the bar is open', () => {
  test('a menu that its `open` prop opens closes the open one with `sibling-open`', async () => {
    const log: string[] = [];
    const { roots } = logged(log);
    roots.edit!.open = false;
    await mountBar({ roots });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    roots.edit!.open = true;
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(log).toEqual(['file true trigger-press', 'file false sibling-open']);
  });

  test('an arrow key of the bar that moves to the next menu prevents its default; with `loopFocus` false, the key at the end keeps the menu open', async () => {
    const log: string[] = [];
    await mountBar({ ...logged(log), bar: { loopFocus: false } });
    element('view').focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(element('view-1')));
    let right: KeyboardEvent | undefined;
    document.addEventListener('keydown', (event) => (right ??= event), { once: true });
    await userEvent.keyboard('{ArrowRight}');
    expect(right?.defaultPrevented).toBe(false);
    expect(popupOf('view')).not.toBe(null);
    expect(log).toEqual(['view true list-navigation']);
    let left: KeyboardEvent | undefined;
    document.addEventListener('keydown', (event) => (left ??= event), { once: true });
    await userEvent.keyboard('{ArrowLeft}');
    expect(left?.defaultPrevented).toBe(true);
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
  });

  test('`openOnHover` false keeps the menu of a trigger closed at a pointer move', async () => {
    await mountBar({ triggers: { edit: { openOnHover: false } } });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('edit')).toBe(null);
  });

  test('a press on the bar beside the triggers closes the menu, and gives the focus to nothing (VUE-85)', async () => {
    await mountBar({ bar: { style: 'width: 400px; height: 40px' } });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    const bar = byTestId('bar')!.getBoundingClientRect();
    await userEvent.pointer([{ coords: { x: bar.right - 5, y: bar.top + 5 } }, '[MouseLeft]']);
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(active()).not.toBe(element('file'));
  });

  test.skipIf(server.browser !== 'chromium')(
    'a tap on another trigger opens its menu one time',
    async () => {
      const log: string[] = [];
      await mountBar(logged(log));
      await userEvent.click(element('file'));
      await waitFor(() => expect(popupOf('file')).not.toBe(null));
      await touchDrag(centerOf(element('edit')), centerOf(element('edit')), 0);
      await waitFor(() => expect(popupOf('edit')).not.toBe(null));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popupOf('edit')).not.toBe(null);
      expect(log.filter((entry) => entry.startsWith('edit'))).toHaveLength(1);
    },
  );
});

describe('modal', () => {
  test('a modal bar blocks the page around the bar and locks the scroll; `modal` false does not', async () => {
    const bar = reactive<Props>({});
    await mountBar({ bar });
    await userEvent.click(element('file'));
    await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
    expect(isScrollLocked()).toBe(true);
    // The triggers of the bar stay in use.
    const point = centerOf(element('view'));
    expect(document.elementFromPoint(point.x, point.y)).toBe(element('view'));
    await userEvent.keyboard('{Escape}');
    bar.modal = false;
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    expect(document.querySelector(BLOCK)).toBe(null);
  });
});

describe('more of the bar', () => {
  test('a disabled bar is no tab stop, and the items of its open menu are disabled', async () => {
    const clicks: string[] = [];
    await mountBar({ bar: { disabled: true }, roots: { file: { defaultOpen: true } } });
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    expect(element('file-1')).toHaveAttribute('aria-disabled', 'true');
    element('file-1').addEventListener('click', () => clicks.push('file-1'));
    await userEvent.click(element('file-1'), { force: true });
    expect(clicks).toEqual([]);
    await userEvent.keyboard('{Escape}');
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()?.id).toBe('after');
  });

  test('a vertical bar: the down key moves to the next trigger and opens nothing; in a right-to-left bar, ArrowLeft opens the menu and ArrowRight does not', async () => {
    await mountBar({ bar: { orientation: 'vertical', dir: 'rtl' } });
    element('file').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(element('edit'));
    expect(popupOf('file')).toBe(null);
    await userEvent.keyboard('{ArrowRight}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('edit')).toBe(null);
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(active()).toBe(element('edit-1')));
  });

  test('a menu of a horizontal bar opens under its trigger', async () => {
    await mountBar();
    await userEvent.click(element('file'));
    await waitFor(() => expect(byTestId('file-positioner')).toHaveAttribute('data-side', 'bottom'));
  });

  test('the focus that moves to another trigger while a menu is open opens its menu', async () => {
    const log: string[] = [];
    await mountBar({ ...logged(log), bar: { modal: false } });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    element('edit').focus();
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    expect(log).toContain('edit true trigger-focus');
    await waitFor(() => expect(popupOf('file')).toBe(null));
  });

  test('a menu of the bar with no trigger leaves the focus on the outside input that a press closes it with', async () => {
    const triggerless = reactive<Props>({ open: true });
    triggerless['onUpdate:open'] = (open: boolean) => (triggerless.open = open);
    await mountBar({ triggerless, bar: { modal: false } });
    await waitFor(() => expect(byTestId('triggerless-popup')).not.toHaveAttribute('hidden'));
    const outside = document.getElementById('after')!;
    await userEvent.click(outside);
    await waitFor(() => expect(byTestId('triggerless-popup')).toHaveAttribute('hidden'));
    expect(active()).toBe(outside);
  });

  test.each(['horizontal', 'vertical'])(
    'a %s bar with a filterable menu: the key along the bar moves to the next trigger, and the open key opens the menu with the focus in its input and the first item highlighted',
    async (orientation) => {
      await mountBar({ bar: { orientation }, filter: true });
      const next = orientation === 'vertical' ? '{ArrowDown}' : '{ArrowRight}';
      const open = orientation === 'vertical' ? '{ArrowRight}' : '{ArrowDown}';
      element('file').focus();
      await userEvent.keyboard(next);
      expect(active()).toBe(element('edit'));
      expect(byTestId('input')).toBe(null);
      element('file').focus();
      await userEvent.keyboard(open);
      await waitFor(() => expect(active()).toBe(byTestId('input')));
      expect(element('file-1')).toHaveAttribute('data-highlighted');
    },
  );

  test.skipIf(server.browser !== 'chromium').each([
    { name: 'a full-width menu', width: 'calc(100vw - 10px)', keepMounted: false, locked: true },
    {
      name: 'a kept full-width menu',
      width: 'calc(100vw - 10px)',
      keepMounted: true,
      locked: true,
    },
    { name: 'a narrow menu', width: '240px', keepMounted: false, locked: false },
  ])(
    'after a tap, $name of a modal bar locks the scroll: $locked',
    async ({ width, keepMounted, locked }) => {
      await mountBar({
        positioners: { file: { style: { width } }, edit: { style: { width: '240px' } } },
        portals: { file: { keepMounted } },
      });
      await touchDrag(centerOf(element('file')), centerOf(element('file')), 0);
      await waitFor(() => expect(popupOf('file')).not.toHaveAttribute('hidden'));
      await waitFor(() => expect(isScrollLocked()).toBe(locked));
      if (!locked) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
      await touchDrag(centerOf(element('edit')), centerOf(element('edit')), 0);
      await waitFor(() => expect(popupOf('edit')).not.toBe(null));
      await waitFor(() => expect(isScrollLocked()).toBe(false));
    },
  );
});
