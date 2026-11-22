import { describe, expect, onTestFinished, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');

/** Removes each style that a case writes on `<html>` and `<body>`, at the end of the case. */
function restorePage() {
  const html = document.documentElement.getAttribute('style');
  const body = document.body.getAttribute('style');
  onTestFinished(() => {
    for (const [element, style] of [
      [document.documentElement, html],
      [document.body, body],
    ] as const) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    document.body.removeAttribute('data-scroll-locked');
  });
}

// Each lock is the way of a library of another overlay. Its unlock comes later than the open of the
// dialog, as at the end of the leave of that overlay.
const externalLocks = [
  {
    name: 'an attribute and a style sheet (react-remove-scroll)',
    lock: () => {
      const style = document.head.appendChild(document.createElement('style'));
      style.textContent = 'body[data-scroll-locked] { overflow: hidden !important; }';
      document.body.setAttribute('data-scroll-locked', '1');
      return () => {
        style.remove();
        document.body.removeAttribute('data-scroll-locked');
      };
    },
  },
  {
    name: 'the `overflow` of <body> (Silk)',
    lock: () => {
      document.body.style.setProperty('overflow', 'hidden');
      return () => document.body.style.removeProperty('overflow');
    },
  },
  {
    name: 'the `overflow-x` and `overflow-y` of <html> (Ariakit)',
    lock: () => {
      const { style } = document.documentElement;
      style.setProperty('scrollbar-gutter', 'stable');
      style.setProperty('overflow-x', 'hidden');
      style.setProperty('overflow-y', 'hidden');
      return () => {
        style.removeProperty('scrollbar-gutter');
        style.removeProperty('overflow-x');
        style.removeProperty('overflow-y');
      };
    },
  },
];

describe('the scroll lock of a modal dialog', () => {
  test.each(externalLocks)(
    'keeps the page locked while the lock of another overlay with $name goes, and unlocks it at the close',
    async ({ lock }) => {
      restorePage();
      const root = reactive<Record<string, unknown>>({ open: false });
      root['onUpdate:open'] = (open: boolean) => (root.open = open);
      mount(DialogParts, { root });
      await nextTick();
      expect(isScrollLocked()).toBe(false);
      const unlock = lock();
      const timer = setTimeout(unlock, 200);
      onTestFinished(() => clearTimeout(timer));
      root.open = true;
      await waitFor(() => expect(popup()).not.toBe(null));
      // The times go across the unlock of the other overlay at 200 ms.
      for (const at of [0, 140, 280, 420]) {
        await wait(at === 0 ? 0 : 140);
        expect(`${at} ms: ${isScrollLocked()}`).toBe(`${at} ms: true`);
      }
      root.open = false;
      await waitFor(() => expect(popup()).toBe(null));
      await waitFor(() => expect(isScrollLocked()).toBe(false));
    },
  );

  test('locks at once when a lock on <body> cannot stop the scroll of the page, and gives the page its `overflow-y` back', async () => {
    restorePage();
    // <html> scrolls the page, so `overflow: hidden` on <body> stops nothing.
    document.documentElement.style.overflowY = 'scroll';
    document.body.style.overflowY = 'hidden';
    expect(isScrollLocked()).toBe(false);
    const root = reactive<Record<string, unknown>>({ open: true });
    mount(DialogParts, { root });
    await waitFor(() => expect(popup()).not.toBe(null));
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    root.open = false;
    await waitFor(() => expect(popup()).toBe(null));
    await waitFor(() => expect(isScrollLocked()).toBe(false));
    expect([document.documentElement.style.overflowY, document.body.style.overflowY]).toEqual([
      'scroll',
      'hidden',
    ]);
  });
});
