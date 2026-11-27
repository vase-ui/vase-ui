import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ContextMenuRootChangeEventDetails } from '@vase-ui/vue/context-menu';
import ContextMenuParts from '../../test/fixtures/ContextMenuParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { movePointerThrough, penDrag, sendTouch, touchDrag } from '../../test/pointer';
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
  await waitFor(() => expect(byTestId('positioner')?.style.opacity).toBe(''));
}

async function rightPress(x: number, y: number) {
  await userEvent.pointer([{ coords: { x, y } }, '[MouseRight>]']);
}

/** Releases the right button: at the point of the press with no point, else after a move. */
async function rightRelease(point?: { x: number; y: number }) {
  await userEvent.pointer(point ? [{ coords: point }, '[/MouseRight]'] : '[/MouseRight]');
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const LONG_PRESS = 600;
const POINT = { x: 100, y: 80 };

afterEach(() => {
  vi.useRealTimers();
});

function fakeTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

/**
 * Moves the fake clock past a long press while the pointer is down. A busy runner can take more
 * time for its protocol calls than a long press, so a case that checks the end of a press uses a
 * fake clock. The helper first waits for a frame: Chromium can dispatch the `pointermove` of a touch
 * at the next frame after its protocol call returned. `during` runs after the frame.
 */
async function holdLongPress(during = () => {}) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  during();
  vi.advanceTimersByTime(LONG_PRESS);
}

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
    // `contextmenu` has `detail` 0 in Chromium and WebKit, and it is no key click.
    expect(popup()).not.toHaveAttribute('data-instant');
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

  test('an attribute reaches the trigger and the positioner one time; the template refs give the elements and `close()`', async () => {
    let presses = 0;
    const log: string[] = [];
    const { trigger, exposed } = await mountContextMenu({
      root: rootEvents(log),
      trigger: { class: 'mine', onPointerdown: () => (presses += 1) },
      positioner: { class: 'mine' },
    });
    expect(trigger.getAttribute('class')).toBe('mine');
    await rightPress(100, 80);
    await placed();
    await rightRelease();
    expect(presses).toBe(1);
    expect(byTestId('positioner')!.getAttribute('class')).toBe('mine');
    const refs = exposed as {
      root: { close(): void };
      trigger: { element: Element | null };
      positioner: { element: Element | null };
    };
    expect(refs.trigger.element).toBe(trigger);
    expect(refs.positioner.element).toBe(byTestId('positioner'));
    refs.root.close();
    await waitFor(() => expect(popup()).toBe(null));
    expect(log.at(-1)).toBe('false imperative-action vase-ui');
  });

  test('a press of the mouse that rests opens nothing', async () => {
    await mountContextMenu();
    await userEvent.pointer([{ coords: { x: 100, y: 80 } }, '[MouseLeft>]']);
    await new Promise((resolve) => setTimeout(resolve, LONG_PRESS));
    await userEvent.pointer('[/MouseLeft]');
    expect(popup()).toBe(null);
  });

  test('a root that opens with no press opens at the top left of the view', async () => {
    await mountContextMenu({ root: { defaultOpen: true } });
    await placed();
    expect(popup()!.checkVisibility()).toBe(true);
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
    await userEvent.pointer([{ coords: { x: 380, y: 400 } }, '[MouseLeft]']);
    await waitFor(() => expect(byTestId('inner-popup')).toBe(null));
    await rightPress(250, 150);
    await waitFor(() => expect(popup()).not.toBe(null));
    await rightRelease();
    expect(byTestId('inner-popup')).toBe(null);
    expect(outer).toEqual(['true trigger-press contextmenu']);
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
    const { trigger } = await mountContextMenu({ root: rootEvents(log) });
    await rightPress(100, 80);
    await placed();
    await rightRelease({ x: 104, y: 84 });
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    log.length = 0;
    // A press and a release in one task: the release comes before 500 ms on a busy machine too.
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 80,
        buttons: 2,
      }),
    );
    document
      .getElementById('outside')!
      .dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 2, clientX: 250, clientY: 180 }),
      );
    await placed();
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

  test('with an `open` that the parent holds, the release on an item clicks it; an open that the parent refuses clicks nothing', async () => {
    const clicks: string[] = [];
    const parent = { accepts: false };
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => {
      if (parent.accepts) root.open = open;
    };
    await mountContextMenu({ root, items: { b: { onClick: () => clicks.push('b') } } });
    await rightPress(100, 80);
    await rightRelease({ x: 120, y: 140 });
    expect(popup()).toBe(null);
    parent.accepts = true;
    await rightPress(100, 80);
    await placed();
    const target = item('b').getBoundingClientRect();
    await rightRelease({ x: target.left + 10, y: target.top + 5 });
    expect(clicks).toEqual(server.platform === 'win32' ? [] : ['b']);
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
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    // The menu key of a keyboard sends a `contextmenu` with no press.
    const next = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
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
    // The menu key of a keyboard sends a `contextmenu` with no press.
    const next = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
  });
});

describe('a long press', () => {
  test.skipIf(server.browser !== 'chromium')(
    'of a touch opens the menu one time; a move of more than 10 px stops it',
    async () => {
      const log: string[] = [];
      await mountContextMenu({ root: rootEvents(log) });
      fakeTimers();
      await touchDrag(POINT, { x: 130, y: 80 }, 3, holdLongPress);
      expect(popup()).toBe(null);
      await touchDrag(POINT, POINT, 0, holdLongPress);
      await waitFor(() => expect(popup()).not.toBe(null));
      vi.advanceTimersByTime(LONG_PRESS);
      expect(popup()).not.toBe(null);
      expect(popup()).not.toHaveAttribute('data-instant');
      expect(log).toHaveLength(1);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'of a touch opens the menu at the touch, and again after a close',
    async () => {
      const point = { x: 100, y: 80 };
      await mountContextMenu();
      await touchDrag(point, point, 0, LONG_PRESS);
      await placed();
      // The anchor is a box of 10 px around the touch.
      const box = popup()!.getBoundingClientRect();
      expect(Math.round(box.left)).toBe(97);
      expect(Math.round(box.top)).toBe(80);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(popup()).toBe(null));
      await touchDrag(point, point, 0, LONG_PRESS);
      await waitFor(() => expect(popup()).not.toBe(null));
    },
  );

  test.skipIf(server.browser !== 'chromium').for([
    { name: 'a tap', touch: () => touchDrag(POINT, POINT, 0), lift: false },
    {
      name: 'a second finger',
      touch: async () => {
        await sendTouch('touchStart', [POINT]);
        await sendTouch('touchStart', [POINT, { x: 150, y: 80 }]);
      },
      lift: true,
    },
    {
      name: 'a canceled touch',
      touch: async () => {
        await sendTouch('touchStart', [POINT]);
        await sendTouch('touchCancel', []);
      },
      lift: false,
    },
  ])('$name opens nothing', async ({ touch, lift }) => {
    await mountContextMenu();
    fakeTimers();
    await touch();
    await holdLongPress();
    if (lift) await sendTouch('touchEnd', []);
    expect(popup()).toBe(null);
  });

  test.skipIf(server.browser !== 'chromium')(
    'of a touch in a trigger in a trigger opens the inner menu only',
    async () => {
      const outer: string[] = [];
      await mountContextMenu({ root: rootEvents(outer), inner: {} });
      const inner = byTestId('inner-trigger')!.getBoundingClientRect();
      const point = { x: inner.left + 10, y: inner.top + 10 };
      await touchDrag(point, point, 0, LONG_PRESS);
      await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
      expect(outer).toEqual([]);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'a `contextmenu` in a long press opens the menu one time, at the point of the event',
    async () => {
      const log: string[] = [];
      const { trigger } = await mountContextMenu({ root: rootEvents(log) });
      fakeTimers();
      // Chrome on Android sends `contextmenu` for a long press.
      const contextmenu = () =>
        trigger.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 80,
          }),
        );
      await touchDrag(POINT, POINT, 0, () => holdLongPress(contextmenu));
      await placed();
      const box = popup()!.getBoundingClientRect();
      expect(Math.round(box.left)).toBe(102);
      expect(Math.round(box.top)).toBe(75);
      expect(log).toEqual(['true trigger-press contextmenu']);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'the lift of a long press clicks nothing, and the next click of an item works',
    async () => {
      const clicks: string[] = [];
      const point = { x: 100, y: 80 };
      await mountContextMenu({ items: { a: { onClick: () => clicks.push('a') } } });
      let lift: MouseEvent | undefined;
      const record = (event: MouseEvent) => (lift ??= event);
      window.addEventListener('click', record, true);
      try {
        await touchDrag(point, point, 0, LONG_PRESS);
        await waitFor(() => expect(popup()).not.toBe(null));
        await new Promise((resolve) => setTimeout(resolve, 50));
      } finally {
        window.removeEventListener('click', record, true);
      }
      expect(lift?.defaultPrevented).toBe(true);
      expect(clicks).toEqual([]);
      item('a').focus();
      await userEvent.keyboard('{Enter}');
      expect(clicks).toEqual(['a']);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'of a pen that moves more than 10 px opens nothing',
    async () => {
      await mountContextMenu();
      fakeTimers();
      await penDrag(POINT, { x: 130, y: 80 }, 3, holdLongPress);
      expect(popup()).toBe(null);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'of a touch that moves less than 10 px opens the menu; a disabled root opens nothing',
    async () => {
      const first = await mountContextMenu();
      fakeTimers();
      await touchDrag(POINT, { x: 105, y: 85 }, 2, holdLongPress);
      await waitFor(() => expect(popup()).not.toBe(null));
      first.unmount();
      vi.useRealTimers();
      const log: string[] = [];
      await mountContextMenu({ root: rootEvents(log, { disabled: true }) });
      fakeTimers();
      await touchDrag(POINT, POINT, 0, holdLongPress);
      expect(popup()).toBe(null);
      expect(log).toEqual([]);
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
      fakeTimers();
      await penDrag({ x: 295, y: 100 }, { x: 304, y: 100 }, 2, holdLongPress);
      expect(popup()).toBe(null);
    },
  );
});

describe('the focus', () => {
  test.each(['{Escape}', '{Tab}', '{Shift>}{Tab}{/Shift}'])(
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

  test('a focus that a script moves out of the menu closes nothing', async () => {
    const { trigger } = await mountContextMenu();
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 80 }),
    );
    await placed();
    await waitFor(() => expect(active()).toBe(popup()));
    document.getElementById('before')!.focus();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(popup()).not.toBe(null);
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

describe('more of the release and the native menu', () => {
  test('a release on an item of a submenu closes each menu with `item-press`; a release on a submenu trigger that opens at a press opens nothing', async () => {
    const log: string[] = [];
    const first = await mountContextMenu({ root: rootEvents(log) });
    await rightPress(100, 80);
    await placed();
    await movePointerThrough({ x: 100, y: 80 }, [centerOf(item('sub'))], 2);
    await waitFor(() => expect(byTestId('sub-popup')).not.toBe(null));
    await waitFor(() => expect(byTestId('sub-positioner')?.style.opacity).toBe(''));
    await movePointerThrough(centerOf(item('sub')), [centerOf(item('s1'))], 2);
    await rightRelease(centerOf(item('s1')));
    await waitFor(() => expect(popup()).toBe(null));
    expect(byTestId('sub-popup')).toBe(null);
    expect(log.map((entry) => entry.split(' ').slice(0, 2).join(' '))).toEqual([
      'true trigger-press',
      'false item-press',
    ]);
    first.unmount();
    await mountContextMenu({ submenu: { openOnHover: false } });
    await rightPress(100, 80);
    await placed();
    await rightRelease(centerOf(item('sub')));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('sub-popup')).toBe(null);
    expect(popup()).not.toBe(null);
  });

  test('a release after 500 ms on the positioner or in a submenu, on no item, keeps the menu open', async () => {
    for (const place of ['positioner', 'submenu']) {
      const log: string[] = [];
      const { unmount } = await mountContextMenu({
        root: rootEvents(log),
        positioner: { style: 'padding: 20px' },
        subPopup: { style: 'padding: 20px' },
      });
      await rightPress(100, 80);
      await placed();
      let point: { x: number; y: number };
      if (place === 'positioner') {
        const box = byTestId('positioner')!.getBoundingClientRect();
        point = { x: box.left + 5, y: box.bottom - 5 };
        await movePointerThrough({ x: 100, y: 80 }, [point], 2);
      } else {
        await movePointerThrough({ x: 100, y: 80 }, [centerOf(item('sub'))], 2);
        await waitFor(() => expect(byTestId('sub-positioner')?.style.opacity).toBe(''));
        const box = byTestId('sub-popup')!.getBoundingClientRect();
        point = { x: box.left + 5, y: box.bottom - 5 };
        await movePointerThrough(
          centerOf(item('sub')),
          [{ x: box.left + 5, y: centerOf(item('sub')).y }, point],
          2,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 520));
      await rightRelease(point);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup(), place).not.toBe(null);
      expect(log).toEqual(['true trigger-press contextmenu']);
      unmount();
    }
  });

  test('a right press on the backdrop closes the menu, and no native menu opens; a `contextmenu` from a popup in the trigger opens no native menu', async () => {
    await mountContextMenu({ backdrop: { style: 'position: fixed; inset: 0' } });
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
    const container = byTestId('trigger')!.appendChild(document.createElement('div'));
    onTestFinished(() => container.remove());
    const portal = reactive<Props>({ to: container });
    await mountContextMenu({ portal, root: { defaultOpen: true } });
    const inner = [...document.querySelectorAll('[data-testid="popup"]')].at(-1)!;
    const fromPopup = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    inner.dispatchEvent(fromPopup);
    expect(fromPopup.defaultPrevented).toBe(true);
  });

  test('`data-popup-open` leaves the trigger at the close', async () => {
    const { trigger } = await mountContextMenu({ root: { defaultOpen: true } });
    await placed();
    expect(trigger).toHaveAttribute('data-popup-open');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  test('with `collisionAvoidance` side `flip`, a menu with no room under the anchor opens above it; a side and offsets of the developer place it', async () => {
    const at = (x: number, y: number) => ({
      getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
    });
    const first = await mountContextMenu({
      root: { defaultOpen: true },
      positioner: {
        collisionAvoidance: { side: 'flip' },
        anchor: at(100, window.innerHeight - 20),
      },
      popup: { style: 'width: 150px; height: 100px' },
    });
    await placed();
    await waitFor(() => expect(byTestId('positioner')).toHaveAttribute('data-side', 'top'));
    first.unmount();
    await mountContextMenu({
      root: { defaultOpen: true },
      positioner: {
        side: 'right',
        align: 'center',
        sideOffset: 11,
        alignOffset: 13,
        anchor: at(100, 200),
      },
      popup: { style: 'width: 150px; height: 100px' },
    });
    await placed();
    const box = popup()!.getBoundingClientRect();
    expect(Math.round(box.left)).toBe(111);
    expect(Math.round(box.top)).toBe(163);
  });
});
