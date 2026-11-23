import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuRootChangeEventDetails, MenuRootHighlightEventDetails } from '@vase-ui/vue/menu';
import MenuInTransition from '../../test/fixtures/MenuInTransition.vue';
import { mostMatches } from '../../test/animation';
import { movePointerThrough } from '../../test/pointer';
import { mount } from '../../test/render';
import { readAfter, readWhen } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const trigger = () => byTestId('trigger')!;
// A modal menu covers the page with a block, so the pointer goes to a point outside the popup.
const leave = () => userEvent.pointer({ coords: { x: innerWidth - 2, y: innerHeight - 2 } });

async function openSubmenu(root: Props = {}) {
  // The submenu reaches below the item `b`, so a point on `b` can be in the triangle from the
  // submenu trigger.
  mount(MenuInTransition, { root, submenuPopup: { style: 'height: 60px' } });
  await nextTick();
  await userEvent.click(trigger());
  await waitFor(() => expect(byTestId('popup')?.checkVisibility()).toBe(true));
  await userEvent.hover(item('sub'));
  await waitFor(() => expect(byTestId('sub-popup')?.checkVisibility()).toBe(true));
}

/** A point on the end of the submenu trigger, and points at the two ends of the item `b`. */
function points() {
  const from = item('sub').getBoundingClientRect();
  const to = item('b').getBoundingClientRect();
  const y = to.top + to.height / 2;
  return {
    start: { x: from.right - 4, y: from.top + from.height / 2 },
    end: { x: to.right - 2, y },
    away: { x: to.left + 4, y },
  };
}

describe('the hover of a submenu', () => {
  test('a pointer that moves in one step from a submenu trigger to a sibling item in the triangle and rests there highlights that item and closes the submenu', async () => {
    await openSubmenu();
    const { start, end } = points();
    await userEvent.pointer({ coords: start });
    await userEvent.pointer({ coords: end });
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
    expect(item('b')).toHaveAttribute('data-highlighted');
  });

  test('with `highlightItemOnHover` of `false`, a pointer that rests on a sibling item in the triangle highlights nothing', async () => {
    await openSubmenu({ highlightItemOnHover: false });
    const { start, end } = points();
    await userEvent.pointer({ coords: start });
    const highlighted = readAfter(item('b'), 'pointermove', 100, () =>
      item('b').hasAttribute('data-highlighted'),
    );
    await userEvent.pointer({ coords: end });
    expect(await highlighted).toBe(false);
  });

  test('a pointer that leaves the triangle on a sibling item gives `itemHighlighted` its `pointermove`', async () => {
    const log: string[] = [];
    await openSubmenu({
      onItemHighlighted: (
        element: HTMLElement | undefined,
        details: MenuRootHighlightEventDetails,
      ) =>
        log.push(`${element?.getAttribute('data-key')} ${details.reason} ${details.event?.type}`),
    });
    const { start, end, away } = points();
    await userEvent.pointer({ coords: start });
    // The second move comes in the rest time of 40 ms, away from the submenu.
    await movePointerThrough(start, [end, away]);
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
    expect(log.at(-1)).toBe('b pointer pointermove');
  });
});

describe('a hover on the trigger while the popup leaves after a hover close', () => {
  test.each([
    { opener: 'a hover', root: {} },
    { opener: '`defaultOpen`', root: { defaultOpen: true } },
  ])(
    'opens the menu at once when $opener opened it, and the same popup goes back',
    async ({ root }) => {
      const log: string[] = [];
      const attrs = reactive<Props>({ openOnHover: true, delay: 0 });
      mount(MenuInTransition, {
        trigger: attrs,
        root: {
          ...root,
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            log.push(`openChange ${open} ${details.reason}`),
        },
      });
      await nextTick();
      await userEvent.hover(trigger());
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      const first = byTestId('popup')!;
      attrs.delay = 10_000;
      // The hover comes in the task where the leave starts.
      const reopened = readWhen(
        () => first.classList.contains('menu-fade-leave-active'),
        () => trigger().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
      );
      const popups = mostMatches('[data-testid="popup"]');
      await leave();
      await reopened;
      await nextTick();
      expect(log.at(-1)).toBe('openChange true trigger-hover');
      expect(byTestId('popup')).toBe(first);
      expect(first).not.toHaveClass('menu-fade-leave-active');
      expect(popups()).toBe(1);
    },
  );

  test('turns a kept popup back at once while its animation of `[hidden]` runs, with no open delay', async () => {
    mount(MenuInTransition, {
      trigger: { openOnHover: true, delay: 500 },
      portal: { keepMounted: true },
    });
    await nextTick();
    await userEvent.hover(trigger());
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'true'));
    await leave();
    await waitFor(() => expect(byTestId('popup')).toHaveAttribute('hidden'));
    const atHover = readAfter(trigger(), 'pointerenter', 100, () =>
      trigger().getAttribute('aria-expanded'),
    );
    await userEvent.hover(trigger());
    expect(await atHover).toBe('true');
    await waitFor(() => expect(byTestId('popup')).not.toHaveAttribute('hidden'));
  });
});
