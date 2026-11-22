import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuEntry } from '../../test/fixtures/menuEntries';
import {
  active,
  activeDescendant,
  closed,
  highlighted,
  inSubmenu,
  input,
  item,
  mountTree,
  opened,
  popup,
  shown,
} from '../../test/menuFilter';
import { clientCenter, holdPress } from '../../test/pointer';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const entries = (...keys: string[]): MenuEntry[] => keys.map((key) => ({ key }));
const submenu = (key: string, items: MenuEntry[], extra: Partial<MenuEntry> = {}): MenuEntry => ({
  key,
  kind: 'submenu',
  filter: {},
  items,
  ...extra,
});
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function mountOpen(props: Props) {
  const result = await mountTree({
    ...props,
    root: { defaultOpen: true, ...(props.root as Props) },
  });
  await opened();
  await waitFor(() => expect(active()).toBe(input()));
  return result;
}

const center = (element: Element) => {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
};

describe('the pointer and the focus of nested inputs', () => {
  test('a pointer move in the popup leaves the focus on another control of the popup', async () => {
    await mountOpen({ entries: [{ key: 'aux', kind: 'button' }, { key: 'Rename' }] });
    item('aux').focus();
    await userEvent.hover(item('Rename'));
    await nextTick();
    expect(active()).toBe(item('aux'));
  });

  test('the pointer on the trigger of the open submenu gives the focus back to the parent input; the submenu stays open', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0, closeDelay: 1000 } })],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(input('Move')).toHaveAttribute('data-highlighted'));
    await userEvent.click(input('Move')!);
    expect(active()).toBe(input('Move'));
    await userEvent.hover(item('Move'));
    await waitFor(() => expect(active()).toBe(input()));
    await waitFor(() => expect(input()).toHaveAttribute('data-highlighted'));
    expect(input('Move')).not.toHaveAttribute('data-highlighted');
    expect(popup('Move')).toBeVisible();
  });

  test('a mouse on the trigger after a tap in the submenu gives the focus back to the parent input', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0, closeDelay: 1000 } })],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await frame();
    input('Move')!.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    );
    input('Move')!.focus();
    expect(active()).toBe(input('Move'));
    await userEvent.hover(item('Move'));
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('the pointer back on the trigger of a plain submenu gives the focus and `data-highlighted` back to the parent input', async () => {
    await mountOpen({
      entries: [{ key: 'Share', kind: 'submenu', trigger: { delay: 0 }, items: entries('Email') }],
    });
    await userEvent.hover(item('Share'));
    await opened('Share');
    await userEvent.hover(item('Email'));
    await waitFor(() => expect(active()).toBe(item('Email')));
    await waitFor(() => expect(input()).not.toHaveAttribute('data-highlighted'));
    await userEvent.hover(item('Share'));
    await waitFor(() => expect(active()).toBe(input()));
    await waitFor(() => expect(input()).toHaveAttribute('data-highlighted'));
  });

  test('the focus comes back to the parent input when a submenu that the pointer opened closes', async () => {
    await mountOpen({
      entries: [
        { key: 'Rename' },
        submenu('Move', entries('Documents'), { trigger: { delay: 0, closeDelay: 0 } }),
      ],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    await userEvent.hover(item('Rename'));
    await closed('Move');
    await waitFor(() => expect(active()).toBe(input()));
    await waitFor(() => expect(input()).toHaveAttribute('data-highlighted'));
  });

  test('a hover opens a submenu and the parent input keeps the focus until the pointer moves in the submenu', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0 } })],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await frame();
    expect(active()).toBe(input());
    expect(input()).toHaveAttribute('data-highlighted');
    await userEvent.hover(popup('Move')!, { position: { x: 2, y: 2 } });
    await waitFor(() => expect(active()).toBe(input('Move')));
    await waitFor(() => expect(input('Move')).toHaveAttribute('data-highlighted'));
  });

  test('in a submenu with no portal, the pointer that gave the focus to its input keeps it there', async () => {
    await mountOpen({
      entries: [
        submenu('Move', entries('Documents', 'Archive'), {
          trigger: { delay: 0 },
          portal: { disabled: true },
        }),
      ],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    await userEvent.hover(item('Archive'));
    await frame();
    expect(active()).toBe(input('Move'));
  });

  test('in a submenu with no portal, a focus that a key gave to its input stays when the pointer goes over the parent input', async () => {
    await mountOpen({
      entries: [
        submenu('Move', entries('Documents', 'Archive'), {
          trigger: { openOnHover: false },
          portal: { disabled: true },
        }),
      ],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Move');
    await userEvent.hover(item('Archive'));
    await userEvent.hover(input()!);
    await frame();
    expect(popup('Move')).toBeVisible();
    expect(active()).toBe(input('Move'));
  });

  test('the focus follows the pointer back to the parent input between two submenu triggers', async () => {
    const focuses: string[] = [];
    // Narrow inputs leave room for a submenu beside the menu, so it covers no trigger.
    const narrow = { style: 'width: 4em' };
    await mountOpen({
      input: { ...narrow, onFocus: () => focuses.push('root') },
      entries: [
        submenu('Move', entries('Option'), {
          input: narrow,
          trigger: { delay: 0, closeDelay: 10 },
        }),
        submenu('Share', [{ key: 'Option2' }], {
          input: narrow,
          trigger: { delay: 50, closeDelay: 10 },
        }),
      ],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    const before = focuses.length;
    await userEvent.hover(item('Share'));
    await waitFor(() => expect(active()).toBe(input()));
    await opened('Share');
    await frame();
    expect(active()).toBe(input());
    expect(focuses.length).toBe(before + 1);
    await userEvent.hover(input('Share')!);
    await waitFor(() => expect(active()).toBe(input('Share')));
  });
});

describe('a hover-opened filterable submenu', () => {
  const hoverMenu = () =>
    mountTree({
      positioner: { sideOffset: 8 },
      entries: [
        { key: 'Rename' },
        { key: 'Duplicate' },
        submenu('Share', entries('Email'), {
          trigger: { delay: 0 },
          positioner: { sideOffset: 4 },
        }),
      ],
    });

  async function openAndHover(trigger: HTMLElement) {
    await userEvent.click(trigger);
    await opened();
    await userEvent.hover(item('Share'));
    await opened('Share');
    await userEvent.hover(input('Share')!);
  }

  test('closes when the pointer goes from its trigger to another item', async () => {
    const { trigger } = await hoverMenu();
    await openAndHover(trigger);
    await userEvent.hover(item('Rename'));
    await closed('Share');
  });

  test('closes when the pointer leaves its popup for another item', async () => {
    const { trigger } = await hoverMenu();
    await openAndHover(trigger);
    await userEvent.hover(item('Email'));
    await userEvent.hover(item('Duplicate'));
    await closed('Share');
  });

  test('closes after a query, and opens again with an empty query', async () => {
    const { trigger } = await hoverMenu();
    await openAndHover(trigger);
    await waitFor(() => expect(active()).toBe(input('Share')));
    await userEvent.keyboard('em');
    expect(input('Share')!.value).toBe('em');
    await userEvent.hover(item('Rename'));
    await closed('Share');
    await userEvent.hover(item('Share'));
    await opened('Share');
    await waitFor(() => expect(input('Share')!.value).toBe(''));
  });
});

describe('the press', () => {
  test('a release of a press from the trigger on a checkbox item checks it, and the input keeps the focus', async () => {
    const { trigger } = await mountTree({
      root: { highlightItemOnHover: false },
      entries: [{ key: 'One' }, { key: 'Two', kind: 'checkbox', attrs: { closeOnClick: false } }],
    });
    const { release } = await holdPress(trigger);
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await new Promise((resolve) => setTimeout(resolve, 200));
    await release(center(item('Two')));
    await waitFor(() => expect(item('Two')).toHaveAttribute('aria-checked', 'true'));
    expect(active()).toBe(input());
  });

  test('a press on the trigger of an open menu does not highlight an item when the trigger takes the focus', async () => {
    const { trigger } = await mountTree({ entries: entries('Rename') });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    trigger.focus();
    await nextTick();
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    expect(highlighted()).toBe(null);
  });
});

describe('the query and the highlight', () => {
  test('a controlled query that hides the highlighted item removes the highlight, and Enter clicks nothing', async () => {
    const clicks: string[] = [];
    const provider = reactive<Props>({ modelValue: 'ban' });
    await mountOpen({
      provider,
      root: { open: true },
      entries: [
        { key: 'Apple', attrs: { onClick: () => clicks.push('Apple') } },
        { key: 'Banana' },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Banana');
    provider.modelValue = 'app';
    await waitFor(() => expect(shown()).toEqual(['Apple']));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual([]);
  });

  test('a focus that goes from the input and back keeps the highlight, and the next key goes on from it', async () => {
    const { trigger } = await mountTree({ entries: entries('Rename', 'Duplicate', 'Delete') });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('Duplicate');
    input()!.blur();
    input()!.focus();
    expect(activeDescendant()).toBe('Duplicate');
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('Delete');
  });

  test('a pointer highlight goes when the pointer leaves the item', async () => {
    await mountOpen({ entries: entries('Rename') });
    await userEvent.hover(item('Rename'));
    await waitFor(() => expect(highlighted()).toBe('Rename'));
    await userEvent.unhover(item('Rename'));
    await waitFor(() => expect(highlighted()).toBe(null));
  });

  test('in a right-to-left popup, the key toward the start on another control gives the focus to the input', async () => {
    await mountOpen({
      positioner: { dir: 'rtl' },
      entries: [{ key: 'aux', kind: 'button' }, { key: 'Rename' }],
    });
    item('aux').focus();
    item('aux').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(active()).toBe(input());
  });
});

describe('VUE-207: the highlight of a parent at a submenu', () => {
  const highlightMenu = (log: [string | undefined, string, string | undefined][]) =>
    mountTree({
      root: {
        open: true,
        onItemHighlighted: (
          element: HTMLElement | undefined,
          details: { reason: string; event?: KeyboardEvent },
        ) =>
          log.push([
            element?.getAttribute('data-key') ?? undefined,
            details.reason,
            details.event?.key,
          ]),
      },
      entries: [submenu('Share', entries('Email'))],
    });

  test('the key across the list opens a filterable submenu and the parent keeps the trigger highlighted; the key back gives the focus to the parent', async () => {
    const log: [string | undefined, string, string | undefined][] = [];
    await highlightMenu(log);
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(log.at(-1)).toEqual(['Share', 'keyboard', 'ArrowDown']);
    await userEvent.keyboard('{ArrowRight}');
    await inSubmenu('Share');
    expect(highlighted()).toBe('Share');
    expect(activeDescendant()).toBe('Share');
    await userEvent.keyboard('{ArrowLeft}');
    await closed('Share');
    await waitFor(() => expect(active()).toBe(input()));
    expect(log.at(-1)).toEqual(['Share', 'keyboard', 'ArrowDown']);
    expect(activeDescendant()).toBe('Share');
  });

  test('Enter opens a filterable submenu, and the parent keeps the trigger highlighted', async () => {
    const log: [string | undefined, string, string | undefined][] = [];
    await highlightMenu(log);
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await inSubmenu('Share');
    expect(log.at(-1)).toEqual(['Share', 'keyboard', 'ArrowDown']);
    expect(highlighted()).toBe('Share');
    expect(activeDescendant()).toBe('Share');
  });
});
