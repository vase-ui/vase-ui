import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import MenubarParts from '../../test/fixtures/MenubarParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { touchDrag } from '../../test/pointer';
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

/** Roots that write each change in `log`. */
function logged(log: string[]) {
  const roots: Record<string, Props> = {};
  for (const key of ['file', 'edit', 'view']) {
    roots[key] = reactive({
      onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
        log.push(`${key} ${open} ${details.reason}`),
    });
  }
  return roots;
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('the bar', () => {
  test('is a menubar with one tab stop; its triggers are menu items', async () => {
    await mountBar();
    const bar = byTestId('bar')!;
    expect(bar).toHaveAttribute('role', 'menubar');
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(element('file')).toHaveAttribute('role', 'menuitem');
    expect(element('file')).toHaveAttribute('aria-haspopup', 'menu');
    expect(element('file')).toHaveAttribute('tabindex', '0');
    expect(element('edit')).toHaveAttribute('tabindex', '-1');
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(element('file'));
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(element('edit'));
    expect(element('edit')).toHaveAttribute('tabindex', '0');
    expect(element('file')).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(active()).toBe(element('view'));
    await userEvent.keyboard('{Home}');
    expect(active()).toBe(element('file'));
    await userEvent.keyboard('{Tab}');
    expect(active()?.id).toBe('after');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(element('file'));
  });

  test('a disabled trigger is out of the keys and is no tab stop', async () => {
    await mountBar({ triggers: { file: { disabled: true } } });
    expect(element('edit')).toHaveAttribute('tabindex', '0');
    element('edit').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(element('view'));
  });

  test('ArrowDown opens the menu with its first item; ArrowUp opens nothing', async () => {
    await mountBar();
    element('file').focus();
    await userEvent.keyboard('{ArrowUp}');
    await nextTick();
    expect(popupOf('file')).toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(element('file-1')));
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
  test('a pointer move on another trigger opens its menu with one openChange, and closes the first with `sibling-open` (VUE-67, VUE-85)', async () => {
    const log: string[] = [];
    await mountBar({ roots: logged(log) });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await waitFor(() => expect(popupOf('edit')).not.toBe(null));
    await waitFor(() => expect(popupOf('file')).toBe(null));
    expect(log).toEqual([
      'file true trigger-press',
      'edit true trigger-hover',
      'file false sibling-open',
    ]);
    expect(popupOf('edit')).toHaveAttribute('data-instant', 'group');
    await waitFor(() => expect(active()).toBe(popupOf('edit')));
    // The new menu stays open after the pointer leaves.
    await userEvent.pointer({ coords: { x: 5, y: 400 } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('edit')).not.toBe(null);
  });

  test('`openOnHover` false keeps the menu of a trigger closed at a pointer move', async () => {
    await mountBar({ triggers: { edit: { openOnHover: false } } });
    await userEvent.click(element('file'));
    await waitFor(() => expect(popupOf('file')).not.toBe(null));
    await userEvent.hover(element('edit'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popupOf('edit')).toBe(null);
  });

  test('an arrow key of the bar that no item used closes the menu and opens the next one', async () => {
    const log: string[] = [];
    await mountBar({ roots: logged(log) });
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
      await mountBar({ roots: logged(log) });
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
