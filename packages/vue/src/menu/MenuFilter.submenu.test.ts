import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuEntry } from '../../test/fixtures/menuEntries';
import {
  active,
  activeDescendant,
  byTestId,
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

/** Mounts an open filterable menu, and waits for the focus in its input. */
async function mountOpen(props: Props) {
  const result = await mountTree({
    ...props,
    root: { defaultOpen: true, ...(props.root as Props) },
  });
  await opened();
  await waitFor(() => expect(active()).toBe(input()));
  return result;
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe('the keys of a filterable submenu', () => {
  test('the key toward the start closes the submenu only with the caret at the start of its query', async () => {
    await mountOpen({ entries: [submenu('Move', entries('Archive'))] });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Move');
    await userEvent.keyboard('ar{ArrowLeft}{ArrowLeft}');
    expect(input('Move')!.selectionStart).toBe(0);
    expect(active()).toBe(input('Move'));
    await userEvent.keyboard('{ArrowLeft}');
    await closed('Move');
    expect(active()).toBe(input());
  });

  test.each([false, true])(
    'Left moves the caret in a submenu input with a query: autoHighlight %s',
    async (autoHighlight) => {
      await mountOpen({
        entries: [submenu('Move', entries('Documents'), { filter: { autoHighlight } })],
      });
      await userEvent.keyboard('{ArrowDown}{ArrowRight}');
      await inSubmenu('Move');
      await userEvent.keyboard('doc{ArrowLeft}');
      expect(active()).toBe(input('Move'));
      expect(input('Move')!.selectionStart).toBe(2);
      expect(input('Move')!.value).toBe('doc');
    },
  );

  test('in a right-to-left menu, Left opens the submenu and Right closes it; the trigger keeps the highlight', async () => {
    await mountOpen({
      positioner: { dir: 'rtl' },
      entries: [submenu('Move', entries('Documents'), { positioner: { dir: 'rtl' } })],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowLeft}');
    await inSubmenu('Move');
    await userEvent.keyboard('{ArrowRight}');
    await closed('Move');
    expect(active()).toBe(input());
    expect(activeDescendant()).toBe('Move');
  });

  test('Escape in the submenu input gives the focus back to the parent input, which filters again', async () => {
    await mountOpen({ entries: [submenu('Move', entries('Documents')), { key: 'Rename' }] });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Move');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Move');
    await userEvent.keyboard('ren');
    expect(input()!.value).toBe('ren');
    expect(shown()).toEqual(['Rename']);
  });

  test('a controlled submenu that closes after the focus left keeps the focus outside', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    await mountOpen({
      root: { modal: false },
      entries: [submenu('Move', entries('Documents'), { root })],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Move');
    const outside = document.getElementById('outside')!;
    outside.focus();
    root.open = false;
    await nextTick();
    await frame();
    expect(active()).toBe(outside);
  });

  test('a plain submenu of a filterable submenu: Right gives the focus to its item, and Left goes back input by input', async () => {
    await mountOpen({
      entries: [submenu('Move', [{ key: 'More', kind: 'submenu', items: entries('Archive') }])],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Move');
    expect(activeDescendant('Move')).toBe('More');
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('Archive')));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(active()).toBe(input('Move')));
    expect(activeDescendant('Move')).toBe('More');
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Move');
  });

  test('Enter on the highlighted trigger opens the submenu; Left comes back, and Down goes on from the trigger', async () => {
    await mountOpen({ entries: [submenu('Share', entries('Email')), { key: 'Delete' }] });
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Share');
    await userEvent.keyboard('{Enter}');
    await inSubmenu('Share');
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Share');
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Delete');
  });

  test('the key across the list does not open a submenu that closed', async () => {
    await mountOpen({
      entries: [
        { key: 'Rename' },
        submenu('Share', entries('Email')),
        submenu('Export', entries('PDF')),
      ],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    await inSubmenu('Share');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Share');
    await userEvent.keyboard('{ArrowUp}');
    expect(activeDescendant()).toBe('Rename');
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    expect(popup('Share')).toBe(null);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    await inSubmenu('Export');
    expect(popup('Share')).toBe(null);
  });

  test('a key across the list during a composition opens no submenu', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { openOnHover: false } })],
    });
    await userEvent.keyboard('{ArrowDown}');
    input()!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      }),
    );
    await frame();
    expect(popup('Move')).toBe(null);
  });

  test('Ctrl, Alt, Meta and Shift with an edit key keep its default and the highlight', async () => {
    await mountOpen({ entries: entries('Rename', 'Duplicate') });
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Rename');
    for (const init of [
      { key: 'ArrowDown', shiftKey: true },
      { key: 'ArrowLeft', shiftKey: true },
      { key: 'ArrowRight', altKey: true },
      { key: 'Home', metaKey: true },
      { key: 'End', shiftKey: true },
    ]) {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      input()!.dispatchEvent(event);
      expect(event.defaultPrevented, init.key).toBe(false);
    }
    await nextTick();
    expect(activeDescendant()).toBe('Rename');
  });

  test('Meta with the key across the list does not open the highlighted submenu', async () => {
    await mountOpen({ entries: [submenu('Share', entries('Email'), { filter: undefined })] });
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('Share');
    input()!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await frame();
    expect(popup('Share')).toBe(null);
    await userEvent.keyboard('{ArrowRight}');
    await opened('Share');
  });

  test.each([
    { filterSubmenu: false, open: '{ArrowRight}', close: '{ArrowLeft}' },
    { filterSubmenu: false, open: '{ArrowRight}', close: '{Shift>}{Tab}{/Shift}' },
    { filterSubmenu: false, open: '{Enter}', close: '{Escape}' },
    { filterSubmenu: true, open: '{ArrowRight}', close: '{ArrowLeft}' },
    { filterSubmenu: true, open: '{ArrowRight}', close: '{Shift>}{Tab}{/Shift}' },
    { filterSubmenu: true, open: '{Enter}', close: '{Escape}' },
  ])(
    'the focus comes back to the input after $open and $close: a filterable submenu $filterSubmenu',
    async ({ filterSubmenu, open, close }) => {
      await mountOpen({
        entries: [
          submenu('More', [{ key: 'child', text: 'Child action' }], {
            filter: filterSubmenu ? {} : undefined,
            trigger: { openOnHover: false },
          }),
          { key: 'Rename' },
        ],
      });
      await userEvent.keyboard(`{ArrowDown}${open}`);
      await opened('More');
      await waitFor(() => expect(active()).toBe(filterSubmenu ? input('More') : item('child')));
      await userEvent.keyboard(close);
      await closed('More');
      await waitFor(() => expect(active()).toBe(input()));
      await userEvent.keyboard('ren');
      expect(input()!.value).toBe('ren');
      expect(shown()).toEqual(['Rename']);
    },
  );
});

describe('Tab in a filterable submenu', () => {
  test('Tab in a submenu that a key opened closes the menu and moves the focus after the trigger', async () => {
    await mountOpen({ root: { modal: false }, entries: [submenu('Share', entries('Email'))] });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('Share');
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(active()?.id).toBe('after'));
    await closed();
  });

  test('Tab in a submenu that a press opened closes the menu and moves the focus after the trigger', async () => {
    const { trigger } = await mountTree({
      root: { modal: false },
      transition: true,
      entries: [submenu('Share', entries('Email'), { trigger: { openOnHover: false } })],
    });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(item('Share'));
    await inSubmenu('Share');
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(active()?.id).toBe('after'));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('the press and the pointer', () => {
  test('a press on the trigger of a filterable submenu gives the focus to its input, and the query filters the submenu only', async () => {
    const { trigger } = await mountTree({
      entries: [
        submenu('Share', entries('Email', 'Link'), { trigger: { openOnHover: false } }),
        { key: 'Delete' },
      ],
    });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(item('Share'));
    await inSubmenu('Share');
    await userEvent.keyboard('em');
    expect(input('Share')!.value).toBe('em');
    expect(shown()).toEqual(['Share', 'Delete', 'Email']);
  });

  test('a filterable submenu of a plain menu is a dialog that its trigger names', async () => {
    await mountTree({
      provider: false,
      root: { defaultOpen: true },
      input: false,
      list: false,
      entries: [
        { key: 'Rename' },
        submenu('Move', entries('Documents', 'Downloads'), { trigger: { delay: 0 } }),
      ],
    });
    await opened();
    const trigger = item('Move');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.hover(trigger);
    const element = await opened('Move');
    expect(element).toHaveAttribute('role', 'dialog');
    expect(trigger).toHaveAttribute('aria-controls', element.id);
    expect(element).toHaveAttribute('aria-labelledby', trigger.id);
  });

  test.each([
    {
      name: 'Down reaches a disabled item of the parent',
      loopFocus: true,
      last: false,
      to: 'Disabled',
    },
    { name: 'Down wraps with `loopFocus`', loopFocus: true, last: true, to: 'Disabled' },
    {
      name: 'Down stops at the end with `loopFocus` false',
      loopFocus: false,
      last: true,
      to: 'Move',
    },
  ])(
    'the trigger of a filterable submenu in a plain menu: $name',
    async ({ loopFocus, last, to }) => {
      const move = submenu('Move', entries('Documents'));
      const rest: MenuEntry[] = [{ key: 'Disabled', attrs: { disabled: true } }, { key: 'Next' }];
      await mountTree({
        provider: false,
        root: { defaultOpen: true, loopFocus },
        input: false,
        list: false,
        entries: last ? [...rest, move] : [move, ...rest],
      });
      await opened();
      item('Move').focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(active()).toBe(item(to));
    },
  );

  test('a hover opens a filterable submenu, and the parent input keeps the focus until the pointer moves in the submenu', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0 } })],
    });
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.hover(item('Move'));
    await opened('Move');
    await frame();
    expect(active()).toBe(input());
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    expect(input('Move')).toHaveAttribute('data-highlighted');
    expect(input('Move')).not.toHaveAttribute('aria-activedescendant');
    expect(activeDescendant()).toBe('Move');
  });

  test('Left in the input of a hover-opened submenu closes it, and the parent input has the focus and the trigger highlighted', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0 } })],
    });
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    await userEvent.keyboard('{ArrowLeft}');
    await closed('Move');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Move');
  });

  test('Right after a hover open of a plain submenu gives the focus to its first item', async () => {
    await mountOpen({
      entries: [
        {
          key: 'Move',
          kind: 'submenu',
          trigger: { delay: 0 },
          items: entries('Documents', 'Downloads'),
        },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.hover(item('Move'));
    await opened('Move');
    await frame();
    expect(active()).toBe(input());
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('Documents')));
  });

  test('a hover on the trigger of a submenu keeps its highlight in the parent', async () => {
    await mountOpen({
      entries: [submenu('Move', entries('Documents'), { trigger: { delay: 0 } })],
    });
    await userEvent.hover(item('Move'));
    await opened('Move');
    expect(activeDescendant()).toBe('Move');
  });
});

describe('the query and the submenu', () => {
  test('a submenu trigger shows when the query matches its text', async () => {
    await mountOpen({
      entries: [{ key: 'Rename' }, submenu('Move to folder', entries('Documents'))],
    });
    await userEvent.keyboard('move');
    expect(shown()).toEqual(['Move to folder']);
  });

  test('the trigger of a plain submenu in a filterable menu follows the query', async () => {
    await mountOpen({
      entries: [
        { key: 'Rename' },
        { key: 'Move to folder', kind: 'submenu', items: entries('Documents') },
      ],
    });
    await userEvent.keyboard('rename');
    expect(shown()).toEqual(['Rename']);
    await userEvent.clear(input()!);
    await userEvent.keyboard('move');
    expect(shown()).toEqual(['Move to folder']);
  });

  test('the trigger of an open submenu stays when a listener cancels the close that its query asks for', async () => {
    await mountOpen({
      entries: [
        { key: 'Rename' },
        {
          key: 'group',
          kind: 'group',
          items: [
            submenu('Move', entries('Documents'), {
              trigger: { delay: 0 },
              root: {
                open: true,
                onOpenChange: (open: boolean, details: { cancel(): void }) => {
                  if (!open) details.cancel();
                },
              },
            }),
          ],
        },
      ],
    });
    await opened('Move');
    input()!.focus();
    await userEvent.keyboard('zzz');
    expect(input()!.value).toBe('zzz');
    await waitFor(() => expect(item('Rename')).not.toBeVisible());
    expect(item('Move')).toBeVisible();
    expect(input('Move')).toBeVisible();
  });

  test('the query hides each kind of item, and the item keeps its role', async () => {
    await mountOpen({
      provider: { defaultValue: 'banana' },
      entries: [
        { key: 'Apple' },
        { key: 'Banana', kind: 'checkbox' },
        { key: 'radio', kind: 'radio-group', items: [{ key: 'Cherry', kind: 'radio' }] },
        { key: 'Date', kind: 'link' },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Banana')).toHaveAttribute('role', 'menuitemcheckbox');
    expect(item('Banana')).not.toHaveAttribute('aria-expanded');
    expect(shown()).toEqual(['Banana']);
    await userEvent.clear(input()!);
    await userEvent.keyboard('cherry{ArrowDown}');
    expect(item('Cherry')).toHaveAttribute('role', 'menuitemradio');
    expect(item('Cherry')).not.toHaveAttribute('aria-expanded');
    expect(shown()).toEqual(['Cherry']);
    await userEvent.clear(input()!);
    await userEvent.keyboard('date{ArrowDown}');
    expect(item('Date')).toHaveAttribute('role', 'menuitem');
    expect(item('Date')).not.toHaveAttribute('aria-expanded');
    expect(shown()).toEqual(['Date']);
    expect(byTestId('radio')).toHaveAttribute('hidden');
  });
});

describe.each([false, true])(
  'the pointer and a filterable submenu: a filterable parent %s',
  (filtered) => {
    async function mountMore(openOnHover?: boolean) {
      await mountTree({
        provider: filtered ? {} : false,
        input: filtered ? {} : false,
        root: { defaultOpen: true, modal: false },
        entries: [
          submenu('More', entries('Share'), {
            trigger: { delay: 0, ...(openOnHover === undefined ? {} : { openOnHover }) },
          }),
        ],
      });
      await opened();
      await waitFor(() => expect(active()).toBe(filtered ? input() : byTestId('list')));
    }

    async function press(element: Element, pointerType: string) {
      const init = { bubbles: true, cancelable: true, pointerType, width: 10, height: 10 };
      element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pressure: 0.5 }));
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail: 1 }));
      await frame();
      element.dispatchEvent(new PointerEvent('pointerup', init));
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, detail: 1 }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    }

    test.each(['mouse', 'touch', 'pen'])(
      'a %s press on a trigger with no hover open gives the focus to the submenu input only for a mouse',
      async (pointerType) => {
        await mountMore(false);
        await press(item('More'), pointerType);
        await opened('More');
        await frame();
        await waitFor(() => expect(active() === input('More')).toBe(pointerType === 'mouse'));
      },
    );

    test('a touch press on a trigger with a hover open does not give the focus to the submenu input', async () => {
      await mountMore();
      await press(item('More'), 'touch');
      await opened('More');
      await frame();
      expect(active()).not.toBe(input('More'));
    });

    test.each(['mouse', 'touch', 'pen'])(
      'a %s press on the trigger of a hover-opened submenu does not give the focus to its input',
      async (pointerType) => {
        await mountMore();
        await userEvent.hover(item('More'));
        await opened('More');
        await frame();
        expect(active()).not.toBe(input('More'));
        await press(item('More'), pointerType);
        await frame();
        expect(active()).not.toBe(input('More'));
      },
    );

    test('a key click on the trigger of a hover-opened submenu gives the focus to its input', async () => {
      await mountMore();
      await userEvent.hover(item('More'));
      await opened('More');
      await frame();
      expect(active()).not.toBe(input('More'));
      item('More').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      await waitFor(() => expect(active()).toBe(input('More')));
    });
  },
);

describe('the query of a filterable submenu', () => {
  test('a controlled query shows in the input and filters; a clear reports `input-clear`', async () => {
    const log: string[] = [];
    const filter = reactive<Props>({ modelValue: 'pro' });
    filter.onValueChange = (value: string, details: { reason: string }) => {
      log.push(`${value} ${details.reason}`);
      filter.modelValue = value;
    };
    await mountOpen({
      entries: [
        submenu('Move', entries('Projects', 'Archive'), { filter, root: { defaultOpen: true } }),
      ],
    });
    await opened('Move');
    expect(input('Move')!.value).toBe('pro');
    expect(item('Archive')).not.toBeVisible();
    await userEvent.clear(input('Move')!);
    expect(log).toContain(' input-clear');
    await waitFor(() => expect(item('Archive')).toBeVisible());
  });

  test('a listener that cancels the change keeps an uncontrolled query', async () => {
    await mountOpen({
      entries: [
        submenu('Move', entries('Projects'), {
          filter: {
            defaultValue: 'pro',
            onValueChange: (_: string, details: { cancel(): void }) => details.cancel(),
          },
          root: { defaultOpen: true },
        }),
      ],
    });
    await opened('Move');
    input('Move')!.focus();
    await userEvent.keyboard('x');
    await nextTick();
    expect(input('Move')!.value).toBe('pro');
  });

  test('a press on an item that closes the whole menu empties the controlled query with `popup-close`', async () => {
    const log: string[] = [];
    const filter = reactive<Props>({ modelValue: '' });
    filter.onValueChange = (value: string, details: { reason: string }) => {
      log.push(`${value} ${details.reason}`);
      filter.modelValue = value;
    };
    await mountTree({
      provider: false,
      input: false,
      list: false,
      root: { defaultOpen: true },
      entries: [
        { key: 'Rename' },
        submenu('Move', entries('Projects', 'Archive'), { filter, root: { defaultOpen: true } }),
      ],
    });
    await opened('Move');
    input('Move')!.focus();
    await userEvent.keyboard('p');
    await waitFor(() => expect(item('Archive')).not.toBeVisible());
    expect(log).toEqual(['p input-change']);
    await userEvent.click(item('Projects'));
    await closed();
    await waitFor(() => expect(log).toEqual(['p input-change', ' popup-close']));
  });
});

describe('a filterable submenu in a plain menu', () => {
  const plainParent = (extra: Partial<MenuEntry> = {}, root: Props = {}) =>
    mountTree({
      provider: false,
      input: false,
      list: false,
      root: { open: true, ...root },
      entries: [
        { key: 'Rename' },
        submenu('Move', entries('Projects', 'Archive'), extra),
        { key: 'Delete' },
      ],
    });

  async function openFromTrigger() {
    await plainParent();
    await opened();
    item('Move').focus();
    await userEvent.keyboard('{ArrowRight}');
    await inSubmenu('Move');
  }

  test('Escape closes it and gives the focus to its trigger, which keeps the highlight', async () => {
    await openFromTrigger();
    await userEvent.keyboard('{Escape}');
    await closed('Move');
    await waitFor(() => expect(active()).toBe(item('Move')));
    expect(item('Move')).toHaveAttribute('data-highlighted');
    expect(popup()).toBeVisible();
  });

  test('the key toward the start closes it and gives the focus to its trigger', async () => {
    await openFromTrigger();
    await userEvent.keyboard('{ArrowLeft}');
    await closed('Move');
    await waitFor(() => expect(active()).toBe(item('Move')));
  });

  test('the key across the list on the trigger of the open submenu gives the focus back to its input', async () => {
    await openFromTrigger();
    item('Move').focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(input('Move')));
    expect(popup('Move')).toBeVisible();
  });

  test('the key toward the start on the trigger of the open submenu closes it', async () => {
    await openFromTrigger();
    item('Move').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await closed('Move');
  });

  test('`always`: the key across the list on the trigger of a hover-opened submenu gives the focus to its input, which keeps the highlight', async () => {
    await plainParent({ filter: { autoHighlight: 'always' }, trigger: { delay: 0 } });
    await opened();
    await userEvent.hover(item('Move'));
    await opened('Move');
    await waitFor(() => expect(activeDescendant('Move')).toBe('Projects'));
    await waitFor(() => expect(active()).toBe(item('Move')));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(input('Move')));
    expect(activeDescendant('Move')).toBe('Projects');
  });

  test('Down on the trigger moves the focus along the parent and prevents the scroll', async () => {
    await plainParent({ trigger: { openOnHover: false } });
    await opened();
    item('Move').focus();
    const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    item('Move').dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(active()).toBe(item('Delete'));
  });

  test('Home on the trigger goes to the first item of the parent and opens nothing', async () => {
    await plainParent();
    await opened();
    item('Move').focus();
    await userEvent.keyboard('{Home}');
    await frame();
    expect(popup('Move')).toBe(null);
    expect(active()).toBe(item('Rename'));
  });

  test('the pointer on the trigger again keeps the focus and the query in the submenu input', async () => {
    await plainParent({ trigger: { delay: 0 } });
    await opened();
    await userEvent.hover(item('Move'));
    await opened('Move');
    await userEvent.hover(input('Move')!);
    await waitFor(() => expect(active()).toBe(input('Move')));
    await userEvent.keyboard('ar');
    expect(input('Move')!.value).toBe('ar');
    await userEvent.hover(item('Move'));
    await frame();
    await frame();
    expect(active()).toBe(input('Move'));
    await userEvent.keyboard('c');
    expect(input('Move')!.value).toBe('arc');
    expect(item('Archive')).toBeVisible();
  });

  test('the key toward the start during a composition keeps the submenu open', async () => {
    await plainParent({ trigger: { openOnHover: false } });
    await opened();
    item('Move').focus();
    await userEvent.keyboard('{ArrowRight}');
    await inSubmenu('Move');
    input('Move')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      }),
    );
    await frame();
    expect(popup('Move')).toBeVisible();
    expect(active()).toBe(input('Move'));
  });
});

describe('a submenu of a horizontal filterable menu', () => {
  test.each([false, true])(
    'the key toward the start in the submenu of the first item closes it and does not wrap: a filterable submenu %s',
    async (filterSubmenu) => {
      const { trigger } = await mountTree({
        root: { orientation: 'horizontal' },
        entries: [
          submenu('More', entries('Child'), { filter: filterSubmenu ? {} : undefined }),
          { key: 'Middle' },
          { key: 'Last' },
        ],
      });
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await opened();
      await waitFor(() => expect(activeDescendant()).toBe('More'));
      await userEvent.keyboard('{ArrowDown}');
      await opened('More');
      await userEvent.keyboard('{ArrowLeft}');
      await closed('More');
      expect(active()).toBe(input());
      expect(activeDescendant()).toBe('More');
      expect(item('Last')).not.toHaveAttribute('data-highlighted');
    },
  );

  test('a submenu in a portal to a shadow root closes at the key toward the start, and the parent moves its highlight', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());
    const { trigger } = await mountTree({
      root: { orientation: 'horizontal' },
      entries: [
        { key: 'First' },
        { key: 'More', kind: 'submenu', portal: { to: shadowRoot }, items: entries('Child') },
        { key: 'Last' },
      ],
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(item('More')).toHaveAttribute('data-highlighted'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(shadowRoot.querySelector('[data-testid="More-popup"]')).not.toBe(null),
    );
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(shadowRoot.querySelector('[data-testid="More-popup"]')).toBe(null));
    expect(item('First')).toHaveAttribute('data-highlighted');
  });
});
