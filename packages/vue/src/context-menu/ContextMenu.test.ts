import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ContextMenuRootChangeEventDetails } from '@vase-ui/vue/context-menu';
import ContextMenuParts from '../../test/fixtures/ContextMenuParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { penDrag, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const active = () => document.activeElement as HTMLElement | null;

async function mountContextMenu(setup: Props = {}) {
  const result = mount(ContextMenuParts, setup);
  await nextTick();
  return { ...result, trigger: byTestId('trigger')! };
}

function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: ContextMenuRootChangeEventDetails) =>
      log.push(`${open} ${details.reason} ${details.event.type}`),
  });
}

async function placed() {
  await waitFor(() => expect(byTestId('positioner')?.style.visibility).toBe(''));
}

async function rightPress(x: number, y: number) {
  await userEvent.pointer([{ coords: { x, y } }, '[MouseRight>]']);
}

/** Releases the right button: at the point of the press with no point, else after a move. */
async function rightRelease(point?: { x: number; y: number }) {
  await userEvent.pointer(point ? [{ coords: point }, '[/MouseRight]'] : '[/MouseRight]');
}

const LONG_PRESS = 600;

describe('the open', () => {
  test('a right press opens the menu at the pointer; the popup takes the focus; the rest of the page is hidden and blocked', async () => {
    const log: string[] = [];
    const { trigger } = await mountContextMenu({ root: rootEvents(log) });
    byTestId('trigger')!.ownerDocument.getElementById('before')!.focus();
    await rightPress(100, 80);
    await placed();
    await rightRelease();
    expect(log).toEqual(['true trigger-press contextmenu']);
    const box = popup()!.getBoundingClientRect();
    // `sideOffset` -5 and `alignOffset` 2 put the popup over the point.
    expect(Math.round(box.left)).toBe(102);
    expect(Math.round(box.top)).toBe(75);
    expect(byTestId('positioner')!.style.position).toBe('fixed');
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(trigger).toHaveAttribute('data-pressed');
    expect(trigger).not.toHaveAttribute('aria-expanded');
    await waitFor(() => expect(active()).toBe(popup()));
    expect(document.getElementById('outside')!.closest('[aria-hidden="true"]')).not.toBe(null);
    expect(isScrollLocked()).toBe(true);
    // The block has no hole: the trigger is under it.
    expect(document.elementFromPoint(100, 80)).not.toBe(trigger);
  });

  test('the trigger prevents the native menu and stops the event', async () => {
    const { trigger } = await mountContextMenu();
    let reached = false;
    trigger.parentElement!.addEventListener('contextmenu', () => (reached = true));
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    trigger.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reached).toBe(false);
    await waitFor(() => expect(popup()).not.toBe(null));
  });

  test('a disabled root prevents nothing and opens nothing', async () => {
    const { trigger } = await mountContextMenu({ root: { disabled: true } });
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await nextTick();
    expect(popup()).toBe(null);
  });

  test('a menu in a trigger in a trigger: only the inner one opens', async () => {
    const outer: string[] = [];
    const { trigger } = await mountContextMenu({ root: rootEvents(outer), inner: {} });
    expect(trigger).not.toBe(null);
    const inner = byTestId('inner-trigger')!.getBoundingClientRect();
    await rightPress(inner.left + 10, inner.top + 10);
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await rightRelease();
    expect(outer).toEqual([]);
  });
});

describe('press, drag, release', () => {
  test('the release on an item clicks it at once', async () => {
    const clicks: string[] = [];
    await mountContextMenu({ items: { b: { onClick: () => clicks.push('b') } } });
    await rightPress(100, 80);
    await placed();
    const target = item('b').getBoundingClientRect();
    await rightRelease({ x: target.left + 10, y: target.top + 5 });
    expect(clicks).toEqual(server.platform === 'win32' ? [] : ['b']);
  });

  test('a release outside closes the menu only after 500 ms; a release within 8 px of the point keeps it', async () => {
    const log: string[] = [];
    await mountContextMenu({ root: rootEvents(log) });
    await rightPress(100, 80);
    await placed();
    await rightRelease({ x: 104, y: 84 });
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    log.length = 0;
    await rightPress(100, 80);
    await placed();
    await rightRelease({ x: 250, y: 180 });
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    log.length = 0;
    await rightPress(100, 80);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 520));
    await rightRelease({ x: 250, y: 180 });
    await waitFor(() => expect(popup()).toBe(null));
    expect(log).toEqual(['true trigger-press contextmenu', 'false cancel-open pointerup']);
  });

  test('a `contextmenu` with no button down starts no drag', async () => {
    const { trigger } = await mountContextMenu();
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 80,
        buttons: 0,
      }),
    );
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 520));
    document.body.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, button: 2, clientX: 250, clientY: 180 }),
    );
    await nextTick();
    expect(popup()).not.toBe(null);
  });
});

describe('a second right press', () => {
  test('while the menu is open moves it to the new point, with no native menu', async () => {
    const log: string[] = [];
    await mountContextMenu({ root: rootEvents(log) });
    await rightPress(60, 60);
    await placed();
    await rightRelease();
    let event: Event | undefined;
    document.addEventListener('contextmenu', (each) => (event = each), {
      capture: true,
      once: true,
    });
    await rightPress(200, 150);
    await rightRelease();
    await placed();
    expect(event?.defaultPrevented).toBe(true);
    expect(Math.round(popup()!.getBoundingClientRect().left)).toBe(202);
    expect(log).toEqual([
      'true trigger-press contextmenu',
      'false outside-press pointerdown',
      'true trigger-press contextmenu',
    ]);
  });

  test('in the leave of a backdrop reaches the trigger', async () => {
    await mountContextMenu({ backdrop: { style: 'transition: opacity 1s; opacity: 1' } });
    await rightPress(60, 60);
    await placed();
    await rightRelease();
    const backdrop = byTestId('backdrop')!;
    await rightPress(200, 150);
    await rightRelease();
    expect(backdrop).toHaveAttribute('inert');
    await placed();
    expect(popup()).not.toBe(null);
  });

  test('outside the trigger closes the menu, and no native menu opens', async () => {
    await mountContextMenu();
    await rightPress(60, 60);
    await placed();
    await rightRelease();
    let event: Event | undefined;
    document.addEventListener('contextmenu', (each) => (event = each), {
      capture: true,
      once: true,
    });
    await rightPress(380, 400);
    await rightRelease();
    await waitFor(() => expect(popup()).toBe(null));
    expect(event?.defaultPrevented).toBe(true);
  });
});

describe('a long press', () => {
  test.skipIf(server.browser !== 'chromium')(
    'of a touch opens the menu one time; a move of more than 10 px stops it',
    async () => {
      const log: string[] = [];
      await mountContextMenu({ root: rootEvents(log) });
      await touchDrag({ x: 100, y: 80 }, { x: 130, y: 80 }, 3, LONG_PRESS);
      expect(popup()).toBe(null);
      await touchDrag({ x: 100, y: 80 }, { x: 100, y: 80 }, 0, LONG_PRESS);
      await waitFor(() => expect(popup()).not.toBe(null));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).not.toBe(null);
      expect(log).toHaveLength(1);
    },
  );

  test.skipIf(server.browser !== 'chromium')('of a pen opens the menu (BUG-4854)', async () => {
    await mountContextMenu();
    await penDrag({ x: 100, y: 80 }, { x: 100, y: 80 }, 0, LONG_PRESS);
    await waitFor(() => expect(popup()).not.toBe(null));
  });

  test.skipIf(server.browser !== 'chromium')(
    'of a pen that leaves the trigger within 10 px opens nothing',
    async () => {
      await mountContextMenu();
      await penDrag({ x: 295, y: 100 }, { x: 304, y: 100 }, 2, LONG_PRESS);
      expect(popup()).toBe(null);
    },
  );
});

describe('the focus', () => {
  test.each(['{Escape}', '{Tab}'])(
    'the close by %s returns the focus to the element that had it before the open',
    async (key) => {
      const { trigger } = await mountContextMenu();
      document.getElementById('before')!.focus();
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 80,
        }),
      );
      await placed();
      await waitFor(() => expect(active()).toBe(popup()));
      await userEvent.keyboard('{ArrowDown}');
      expect(active()).toBe(item('a'));
      await userEvent.keyboard(key);
      await waitFor(() => expect(popup()).toBe(null));
      expect(active()?.id).toBe('before');
    },
  );

  test('Tab in a submenu closes each menu and returns the focus to the element that had it before the open (VUE-107)', async () => {
    const { trigger } = await mountContextMenu();
    document.getElementById('before')!.focus();
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 80 }),
    );
    await placed();
    await waitFor(() => expect(active()).toBe(popup()));
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(popup()).toBe(null));
    expect(active()?.id).toBe('before');
  });

  test('a submenu opens at the inline end of its trigger', async () => {
    await mountContextMenu();
    await rightPress(100, 80);
    await placed();
    await rightRelease();
    await waitFor(() => expect(active()).toBe(popup()));
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    expect(byTestId('sub-positioner')).toHaveAttribute('data-side', 'inline-end');
  });
});
