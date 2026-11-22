import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive, type Component } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import MenuFilterTree from '../../test/fixtures/MenuFilterTree.vue';
import MenuInFilterPopup from '../../test/fixtures/MenuInFilterPopup.vue';
import MenuPartAlone from '../../test/fixtures/MenuPartAlone.vue';
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
  openWithKey,
  popup,
} from '../../test/menuFilter';
import { createAppOf, hydrate, mount, mountError, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
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
const hiddenFromAssistiveTechnology = (element: Element) =>
  element.closest('[aria-hidden="true"], [inert]') !== null;

async function mountOpen(props: Props) {
  const result = await mountTree({
    ...props,
    root: { defaultOpen: true, ...(props.root as Props) },
  });
  await opened();
  await waitFor(() => expect(active()).toBe(input()));
  return result;
}

/** Mounts a component whose part throws after the mount, as in a portal, and returns the error. */
async function laterError(component: Component, props: Props) {
  const errors: unknown[] = [];
  const root = document.body.appendChild(document.createElement('div'));
  const app = createAppOf(component, props, false);
  app.config.errorHandler = (error) => {
    errors.push(error);
  };
  app.mount(root);
  onTestFinished(() => {
    app.unmount();
    root.remove();
  });
  await waitFor(() => expect(errors).not.toEqual([]));
  return String(errors[0]);
}

/** The press of iOS VoiceOver: a touch of a third of a pixel with no pressure. */
function pressLikeVoiceOver(element: Element) {
  const init = {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
    width: 0.333,
    height: 0.333,
    pressure: 0,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }),
  );
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 1 }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}

/** A press of `pointerType` with a size and a pressure, as a finger or a pen gives. */
async function press(element: Element, pointerType: string) {
  const init = { bubbles: true, cancelable: true, pointerType, width: 10, height: 10 };
  element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pressure: 0.5 }));
  element.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }),
  );
  await frame();
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 1 }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}

describe('the errors', () => {
  test('a part of the filter throws an error that names it, alone and in a menu with no provider', async () => {
    for (const part of ['Input', 'Clear', 'Empty']) {
      expect(String(mountError(MenuPartAlone, { part, place: 'alone' }))).toContain(
        `<Menu.${part}> must be inside`,
      );
      expect(await laterError(MenuPartAlone, { part, place: 'popup' })).toContain(
        `<Menu.${part}> must be in a menu inside <Menu.FilterProvider>`,
      );
    }
    takeReportedMessages();
  });

  test('an input in a plain submenu of a filterable menu throws an error', async () => {
    const error = await laterError(MenuFilterTree, {
      root: { defaultOpen: true },
      entries: [
        {
          key: 'Move',
          kind: 'submenu',
          root: { defaultOpen: true },
          input: {},
          items: entries('Projects'),
        },
      ],
    });
    expect(error).toContain('<Menu.Input> must be in a menu inside <Menu.FilterProvider>');
    takeReportedMessages();
  });
});

describe('the names and the ids', () => {
  test('a filterable submenu of a plain menu: the trigger of the root opens a menu, and the submenu is a dialog with the input that its trigger names', async () => {
    const { trigger } = await mountTree({
      provider: false,
      root: { open: true },
      input: false,
      list: false,
      entries: [{ key: 'Rename' }, submenu('Move', entries('Projects'), { root: { open: true } })],
    });
    const dialog = await opened('Move');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(item('Move')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', item('Move').id);
    expect(dialog).toContainElement(input('Move'));
  });

  test('`aria-label` of the developer names the popup in place of the trigger', async () => {
    const { trigger } = await mountTree({
      popup: { 'aria-label': 'Available commands' },
      entries: entries('Apple'),
    });
    await userEvent.click(trigger);
    expect(await opened()).toHaveAttribute('aria-label', 'Available commands');
    expect(popup()).not.toHaveAttribute('aria-labelledby');
  });

  test('a menu with no trigger names its dialog and its list with nothing', async () => {
    await mountTree({
      root: { defaultOpen: true },
      trigger: false,
      positioner: { anchor: document.body },
      entries: entries('Rename'),
    });
    await opened();
    expect(popup()).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
  });

  test('VUE-93: an empty `id` counts as no `id`: the list and the trigger get a generated id, and the input and the list name them', async () => {
    await mountTree({
      root: { defaultOpen: true },
      trigger: { id: '' },
      list: { id: '' },
      entries: entries('Rename'),
    });
    await opened();
    const list = byTestId('list')!;
    const trigger = byTestId('trigger')!;
    expect(list.id).not.toBe('');
    expect(trigger.id).not.toBe('');
    await waitFor(() => expect(input()).toHaveAttribute('aria-controls', list.id));
    expect(list).toHaveAttribute('aria-labelledby', trigger.id);
  });
});

describe('a handle', () => {
  test('a trigger outside the root has `aria-haspopup` dialog; a press opens the menu with the focus in the input; it controls the popup, and the popup and the list name it', async () => {
    const handle = Menu.createHandle();
    await mountTree({
      root: { handle },
      trigger: false,
      detached: { handle, id: 'fruit-trigger' },
      entries: entries('Apple'),
    });
    const trigger = byTestId('detached')!;
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(popup()).toBe(null);
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    expect(item('Apple')).toBeVisible();
    expect(trigger).toHaveAttribute('aria-controls', popup()!.id);
    expect(popup()).toHaveAttribute('aria-labelledby', 'fruit-trigger');
    expect(byTestId('list')).toHaveAttribute('aria-labelledby', 'fruit-trigger');
  });

  test('the focus of another trigger of the handle highlights no item', async () => {
    const handle = Menu.createHandle();
    const log: unknown[] = [];
    const { trigger } = await mountTree({
      root: { handle, onItemHighlighted: (element: unknown) => log.push(element) },
      trigger: { handle },
      detached: { handle },
      entries: entries('Rename', 'Delete'),
    });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    log.length = 0;
    byTestId('detached')!.focus();
    await nextTick();
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(highlighted()).toBe(null);
    expect(log).toEqual([]);
  });
});

describe('the listeners of the developer', () => {
  test('each listener runs one time for each event: a press on the trigger, a key on the input, and a key that reaches the popup', async () => {
    const log: string[] = [];
    const { trigger } = await mountTree({
      trigger: { onClick: () => log.push('trigger click') },
      popup: { onKeydown: (event: KeyboardEvent) => log.push(`popup ${event.key}`) },
      input: { onKeydown: (event: KeyboardEvent) => log.push(`input ${event.key}`) },
      entries: entries('Rename'),
    });
    await userEvent.click(trigger);
    expect(log).toEqual(['trigger click']);
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('r');
    expect(log).toEqual(['trigger click', 'input r', 'popup r']);
    await userEvent.keyboard('{Escape}');
    expect(log).toEqual(['trigger click', 'input r', 'popup r', 'input Escape', 'popup Escape']);
  });

  test('a capture listener on the input that prevents the default of a key stops the list and the click', async () => {
    const clicks: string[] = [];
    await mountOpen({
      input: {
        onKeydownCapture: (event: KeyboardEvent) => {
          if (event.key === 'ArrowUp' || event.key === 'Enter') event.preventDefault();
        },
      },
      entries: [
        { key: 'Rename', attrs: { onClick: () => clicks.push('Rename') } },
        { key: 'Delete' },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Rename');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(activeDescendant()).toBe('Rename');
    expect(clicks).toEqual([]);
  });
});

describe('the trigger of a hover-opened filterable menu', () => {
  async function openByHover(trigger: Props = {}) {
    const result = await mountTree({
      trigger: { openOnHover: true, delay: 0, ...trigger },
      entries: entries('Rename', 'Delete'),
    });
    result.trigger.focus();
    await userEvent.hover(result.trigger);
    await opened();
    expect(active()).toBe(result.trigger);
    return result;
  }

  test('Down on the trigger gives the focus to the input and highlights the first item', async () => {
    await openByHover();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(input()));
    expect(activeDescendant()).toBe('Rename');
  });

  test('a character on the trigger goes to the input', async () => {
    await openByHover();
    await userEvent.keyboard('r');
    await waitFor(() => expect(active()).toBe(input()));
    expect(input()!.value).toBe('r');
  });

  test('a key with Control and a key across the list keep the focus on the trigger', async () => {
    const { trigger } = await openByHover();
    await userEvent.keyboard('{Control>}r{/Control}');
    expect(active()).toBe(trigger);
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(trigger);
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });

  test('Right on the trigger does not open a highlighted submenu', async () => {
    const { trigger } = await mountTree({
      provider: { autoHighlight: 'always' },
      trigger: { openOnHover: true, delay: 0 },
      entries: [submenu('Move', entries('Documents')), { key: 'Delete' }],
    });
    trigger.focus();
    await userEvent.hover(trigger);
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Move'));
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    await frame();
    expect(popup('Move')).toBe(null);
    expect(active()).toBe(trigger);
  });

  test('a capture listener on the trigger that prevents the default of the key keeps it on the trigger', async () => {
    const { trigger } = await openByHover({
      onKeydownCapture: (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') event.preventDefault();
      },
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(trigger);
  });
});

describe('items that come and go', () => {
  const highlightLog = (log: (string | undefined)[]) => (element: HTMLElement | undefined) =>
    log.push(element?.getAttribute('data-key') ?? undefined);

  test('VUE-206: an item that mounts before the highlighted item leaves the highlight on its item, and reports nothing', async () => {
    const log: (string | undefined)[] = [];
    const list = reactive<MenuEntry[]>(entries('Rename', 'Delete', 'Duplicate'));
    await mountTree({ root: { open: true, onItemHighlighted: highlightLog(log) }, entries: list });
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(log.at(-1)).toBe('Delete');
    log.length = 0;
    list.unshift({ key: 'Archive' });
    await nextTick();
    await frame();
    expect(log).toEqual([]);
    expect(activeDescendant()).toBe('Delete');
  });

  test('an item that the query hides and that mounts keeps the highlight, and reports nothing', async () => {
    const log: (string | undefined)[] = [];
    const list = reactive<MenuEntry[]>(entries('Report A', 'Report B', 'Other'));
    await mountTree({ root: { open: true, onItemHighlighted: highlightLog(log) }, entries: list });
    await opened();
    input()!.focus();
    await userEvent.keyboard('rep{ArrowDown}{ArrowDown}');
    expect(activeDescendant()).toBe('Report B');
    log.length = 0;
    list.push({ key: 'Zebra' });
    await nextTick();
    await frame();
    expect(item('Zebra')).not.toBeVisible();
    expect(activeDescendant()).toBe('Report B');
    expect(log).toEqual([]);
  });

  test('after a reopen from a query, an item that mounts keeps the highlight', async () => {
    const list = reactive<MenuEntry[]>(entries('Save', 'Save as', 'Delete'));
    const { trigger } = await mountTree({ entries: list });
    await openWithKey(trigger);
    await userEvent.keyboard('sav{Escape}');
    await closed();
    await waitFor(() => expect(active()).toBe(trigger));
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    expect(activeDescendant()).toBe('Save as');
    list.push({ key: 'Recent' });
    await nextTick();
    expect(item('Recent')).toBeVisible();
    expect(activeDescendant()).toBe('Save as');
  });

  test('VUE-209: Empty keeps its `status` region in the DOM with no content while an item shows, and adds its text when no item shows', async () => {
    await mountOpen({ empty: 'No fruit found', entries: entries('Apple') });
    const status = byTestId('empty')!;
    expect(status).toHaveAttribute('role', 'status');
    expect(status.matches(':empty')).toBe(true);
    await userEvent.keyboard('zz');
    await waitFor(() => expect(status).toHaveTextContent('No fruit found'));
    expect(byTestId('empty')).toBe(status);
  });

  test('Empty shows with no item at all', async () => {
    await mountTree({ root: { defaultOpen: true }, empty: 'No actions found', entries: [] });
    await opened();
    await waitFor(() => expect(byTestId('empty')).toHaveTextContent('No actions found'));
  });

  test('a group with no item stays while the query filters', async () => {
    await mountOpen({
      entries: [
        { key: 'section', kind: 'group', label: 'Empty section', items: [] },
        { key: 'Rename' },
      ],
    });
    await userEvent.keyboard('ren');
    expect(item('Rename')).toBeVisible();
    expect(byTestId('section')).toBeVisible();
  });

  test('a group around a kept filterable submenu hides when the query of the parent hides its trigger', async () => {
    await mountOpen({
      entries: [
        {
          key: 'organize',
          kind: 'group',
          label: 'Organize',
          items: [
            submenu(
              'Move to',
              [
                { key: 'folders', kind: 'group', label: 'Folders', items: entries('Projects') },
                { key: 'Loose' },
              ],
              { portal: { keepMounted: true } },
            ),
          ],
        },
        { key: 'other', kind: 'group', label: 'Other', items: entries('Rename') },
      ],
    });
    expect(byTestId('organize')).not.toHaveAttribute('hidden');
    await userEvent.keyboard('rena');
    await waitFor(() => expect(item('Move to')).not.toBeVisible());
    await waitFor(() => expect(byTestId('organize')).toHaveAttribute('hidden'));
  });

  test('an item whose child stops rendering its text stops matching it', async () => {
    const texts = reactive<MenuEntry[]>([{ key: 'async', text: 'Rename' }, { key: 'Delete' }]);
    await mountTree({ root: { open: true }, entries: texts });
    await opened();
    texts[0]!.text = '';
    await nextTick();
    input()!.focus();
    await userEvent.keyboard('rename');
    await waitFor(() => expect(item('async')).not.toBeVisible());
  });

  test('the arrow keys reach a disabled item; Enter on it clicks nothing and the menu stays open', async () => {
    const clicks: string[] = [];
    await mountOpen({
      entries: [
        { key: 'Rename' },
        { key: 'Archive', attrs: { disabled: true, onClick: () => clicks.push('Archive') } },
        { key: 'Delete' },
      ],
    });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeDescendant()).toBe('Archive');
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual([]);
    expect(popup()).toBeVisible();
  });
});

describe('a server render', () => {
  test('Empty with no item shows its text after the hydration', async () => {
    const props = { root: { open: true }, empty: 'No actions found', entries: [] };
    const root = await renderOnServer('MenuFilterTree', props);
    expect(root.querySelector('[data-testid="empty"]')).toBe(null);
    hydrate(MenuFilterTree, props, root);
    await waitFor(() => expect(byTestId('empty')).toHaveTextContent('No actions found'));
  });
});

describe('the focus trap', () => {
  test.each([
    { name: 'a hover open', open: (trigger: HTMLElement) => userEvent.hover(trigger), hover: true },
    {
      name: 'a click of an assistive technology',
      open: (trigger: HTMLElement) => {
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: '' }));
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        return Promise.resolve();
      },
      hover: false,
    },
    { name: 'a touch', open: (trigger: HTMLElement) => press(trigger, 'touch'), hover: false },
  ])(
    'a filterable menu that $name opened keeps the page outside it for assistive technology',
    async ({ open, hover }) => {
      const { trigger } = await mountTree({
        trigger: hover ? { openOnHover: true, delay: 0 } : {},
        entries: entries('Rename'),
      });
      await open(trigger);
      await opened();
      expect(hiddenFromAssistiveTechnology(document.getElementById('after')!)).toBe(false);
    },
  );

  test('Tab leaves a filterable popup with `modal` false', async () => {
    await mountOpen({ root: { modal: false }, entries: entries('Rename') });
    expect(hiddenFromAssistiveTechnology(document.getElementById('after')!)).toBe(false);
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(active()?.id).toBe('after'));
  });

  test('a filterable submenu is not hidden from assistive technology', async () => {
    await mountOpen({ entries: [{ key: 'Rename' }, submenu('More', entries('Share'))] });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    await inSubmenu('More');
    expect(hiddenFromAssistiveTechnology(popup('More')!)).toBe(false);
  });

  test('Shift+Tab in a plain menu inside the popup of a filterable menu gives the focus to its own trigger', async () => {
    mount(MenuInFilterPopup);
    await waitFor(() => expect(item('independent-action')).toBeVisible());
    item('independent-action').focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() =>
      expect(document.querySelector('[data-key="independent-action"]')).toBe(null),
    );
    await waitFor(() => expect(active()).toBe(byTestId('independent')));
  });
});

describe('the list and the input', () => {
  test('a list that has the focus while the input does not keeps it', async () => {
    await mountTree({ root: { defaultOpen: true }, entries: entries('Rename') });
    await opened();
    input()!.blur();
    byTestId('list')!.focus();
    await nextTick();
    expect(active()).toBe(byTestId('list'));
  });

  test.each([
    { orientation: 'vertical', dir: 'ltr', key: 'ArrowLeft' },
    { orientation: 'vertical', dir: 'rtl', key: 'ArrowRight' },
    { orientation: 'horizontal', dir: 'ltr', key: 'ArrowUp' },
    { orientation: 'horizontal', dir: 'rtl', key: 'ArrowUp' },
  ])(
    'the key toward the start, $key, on another control of a $orientation $dir popup gives the focus to the input',
    async ({ orientation, dir, key }) => {
      await mountOpen({
        root: { orientation },
        positioner: { dir },
        entries: [{ key: 'aux', kind: 'button' }, { key: 'Rename' }],
      });
      item('aux').focus();
      item('aux').dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      expect(active()).toBe(input());
    },
  );

  test('a filterable menu with a Viewport keeps the focus in the input at an arrow key', async () => {
    await mountOpen({ list: false, viewport: true, entries: entries('Rename', 'Delete') });
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(input());
    expect(activeDescendant()).toBe('Rename');
  });
});

describe('a press of a screen reader', () => {
  test('a press of iOS VoiceOver on the trigger gives the focus to the input', async () => {
    const { trigger } = await mountTree({ entries: entries('Rename') });
    trigger.focus();
    pressLikeVoiceOver(trigger);
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('a press of iOS VoiceOver on the trigger of a filterable submenu gives the focus to its input', async () => {
    await mountTree({
      provider: false,
      input: false,
      list: false,
      root: { defaultOpen: true },
      entries: [submenu('Move', entries('Documents'), { trigger: { openOnHover: false } })],
    });
    await opened();
    pressLikeVoiceOver(item('Move'));
    await inSubmenu('Move');
  });

  test('a tap on an item after a touch open does not give the focus to the input', async () => {
    const focuses: string[] = [];
    const { trigger } = await mountTree({
      input: { onFocus: () => focuses.push('input') },
      entries: entries('Rename', 'Delete'),
    });
    await press(trigger, 'touch');
    await opened();
    await frame();
    const rename = item('Rename');
    rename.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    rename.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    rename.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    rename.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await frame();
    expect(active()).not.toBe(input());
    expect(focuses).toEqual([]);
  });

  test.each(['touch', 'pen'])(
    'a %s that moves in the popup after a touch open does not give the focus to the input',
    async (pointerType) => {
      const focuses: string[] = [];
      const { trigger } = await mountTree({
        input: { onFocus: () => focuses.push('input') },
        entries: entries('Rename', 'Delete'),
      });
      await press(trigger, 'touch');
      await opened();
      await frame();
      item('Rename').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType }));
      await frame();
      expect(active()).not.toBe(input());
      expect(focuses).toEqual([]);
    },
  );
});

describe('the trigger of a filterable submenu', () => {
  test('the parent input keeps the focus until a press opens the submenu, and its input then has it', async () => {
    await mountTree({
      root: { open: true },
      entries: [
        { key: 'Rename' },
        submenu('Move', entries('Documents'), { trigger: { openOnHover: false } }),
      ],
    });
    await opened();
    input()!.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeDescendant()).toBe('Move');
    expect(item('Move')).toHaveAttribute('tabindex', '-1');
    expect(active()).toBe(input());
    await userEvent.click(item('Move'));
    await inSubmenu('Move');
  });

  test('`aria-haspopup` of the developer wins on a submenu trigger and on a trigger', async () => {
    await mountTree({
      root: { defaultOpen: true },
      trigger: { 'aria-haspopup': 'menu' },
      entries: [submenu('Move', entries('Projects'), { trigger: { 'aria-haspopup': 'menu' } })],
    });
    await opened();
    expect(byTestId('trigger')).toHaveAttribute('aria-haspopup', 'menu');
    expect(item('Move')).toHaveAttribute('aria-haspopup', 'menu');
  });
});

describe.runIf(server.browser === 'webkit')('`aria-selected` in WebKit', () => {
  test('the highlighted item keeps `aria-selected` when a new input with the focus replaces the input', async () => {
    const inputKey = reactive({ key: 'first' });
    await mountOpen({ input: { autofocus: true }, inputKey, entries: entries('Apple', 'Banana') });
    inputKey.key = 'second';
    await nextTick();
    input()!.focus();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
  });

  test('`aria-selected` follows the focus of a new input that replaces the input', async () => {
    const inputKey = reactive({ key: 'first' });
    await mountOpen({ inputKey, entries: entries('Apple', 'Banana') });
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    const first = input();
    inputKey.key = 'second';
    await nextTick();
    expect(input()).not.toBe(first);
    expect(item('Apple').getAttribute('aria-selected')).toBe(
      input()!.matches(':focus') ? 'true' : null,
    );
  });

  test('an input that leaves while the menu stays open takes `aria-selected` from the items', async () => {
    const parts = reactive<Record<string, boolean>>({});
    await mountOpen({ shown: parts, entries: entries('Apple', 'Banana') });
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    parts.input = false;
    await nextTick();
    expect(input()).toBe(null);
    expect(item('Apple')).not.toHaveAttribute('aria-selected');
  });

  test('a hover reopen after the input left gives no `aria-selected`', async () => {
    const root = reactive<Props>({ open: true });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    const { trigger } = await mountTree({
      provider: { autoHighlight: 'always' },
      root,
      trigger: { openOnHover: true, delay: 0 },
      entries: entries('Apple'),
    });
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    root.open = false;
    await closed();
    await userEvent.hover(trigger);
    await opened();
    expect(active()).not.toBe(input());
    expect(item('Apple')).not.toHaveAttribute('aria-selected');
  });

  test('a checkbox item and a radio item keep `aria-checked` with `aria-selected`', async () => {
    await mountOpen({
      entries: [
        { key: 'Details', kind: 'checkbox', attrs: { defaultChecked: true } },
        {
          key: 'sort',
          kind: 'radio-group',
          attrs: { defaultValue: 'Date' },
          items: [{ key: 'Date', kind: 'radio' }],
        },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Details')).toHaveAttribute('aria-selected', 'true');
    expect(item('Details')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Date')).toHaveAttribute('aria-selected', 'true');
    expect(item('Date')).toHaveAttribute('aria-checked', 'true');
  });

  test('a highlighted link and a highlighted submenu trigger have `aria-selected`', async () => {
    await mountOpen({
      entries: [
        { key: 'Documentation', kind: 'link' },
        submenu('More actions', entries('Share')),
        { key: 'Plain submenu', kind: 'submenu', items: entries('Copy') },
      ],
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Documentation')).toHaveAttribute('aria-selected', 'true');
    expect(item('More actions')).not.toHaveAttribute('aria-selected');
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Documentation')).not.toHaveAttribute('aria-selected');
    expect(item('More actions')).toHaveAttribute('aria-selected', 'true');
    expect(item('Plain submenu')).not.toHaveAttribute('aria-selected');
    await userEvent.keyboard('{ArrowDown}');
    expect(item('More actions')).not.toHaveAttribute('aria-selected');
    expect(item('Plain submenu')).toHaveAttribute('aria-selected', 'true');
  });

  test('the items of an open filterable submenu have `aria-selected` while its input has the focus', async () => {
    await mountOpen({ entries: [submenu('More actions', entries('Share'))] });
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await inSubmenu('More actions');
    expect(item('More actions')).not.toHaveAttribute('aria-selected');
    expect(item('Share')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    expect(item('Share')).not.toHaveAttribute('aria-selected');
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Share')).toHaveAttribute('aria-selected', 'true');
  });

  test('the items of a plain menu have no `aria-selected`', async () => {
    await mountTree({
      provider: false,
      input: false,
      list: false,
      root: { defaultOpen: true },
      entries: entries('Apple'),
    });
    await opened();
    await waitFor(() => expect(active()).toBe(popup()));
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('Apple');
    expect(item('Apple')).not.toHaveAttribute('aria-selected');
  });
});
