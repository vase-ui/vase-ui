import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Menu, type MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import MenuInPopover from '../../test/fixtures/MenuInPopover.vue';
import MenuInTransition from '../../test/fixtures/MenuInTransition.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import MenuEachPart from '../../test/fixtures/MenuEachPart.vue';
import MenuPartAlone from '../../test/fixtures/MenuPartAlone.vue';
import MenuViewportParts from '../../test/fixtures/MenuViewportParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const subPopup = () => byTestId('sub-popup');
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const active = () => document.activeElement as HTMLElement | null;
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';

async function mountMenu(setup: Props = {}) {
  const result = mount(MenuParts, setup);
  await nextTick();
  const trigger = result.root.querySelector<HTMLElement>('[data-testid="trigger"]')!;
  return { ...result, trigger };
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

async function opened(find = popup) {
  await waitFor(() => expect(find()).not.toBe(null));
  return find()!;
}

async function closed(find = popup) {
  await waitFor(() => expect(find()).toBe(null));
}

async function placed() {
  await waitFor(() => expect(byTestId('positioner')?.style.visibility).toBe(''));
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Opens the menu with Enter on the trigger: the first item has the focus. */
async function openWithKeyboard(trigger: HTMLElement) {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await opened();
  await waitFor(() => expect(active()?.getAttribute('data-key')).toBe('a'));
}

describe('the parts', () => {
  test('render their elements and roles; the trigger names the popup; a template ref has element', async () => {
    const { trigger, exposed } = await mountMenu({
      checkbox: {},
      radio: {},
      link: {},
      group: {},
    });
    expect(trigger.localName).toBe('button');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    await userEvent.click(trigger);
    const element = await opened();
    expect(exposed.popup.element).toBe(element);
    expect(element).toHaveAttribute('role', 'menu');
    expect(element).toHaveAttribute('tabindex', '-1');
    expect(element).toHaveAttribute('aria-labelledby', trigger.id);
    expect(element).not.toHaveAttribute('aria-orientation');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', element.id);
    expect(item('a')).toHaveAttribute('role', 'menuitem');
    expect(item('a')).toHaveAttribute('tabindex', '-1');
    expect(item('checkbox')).toHaveAttribute('role', 'menuitemcheckbox');
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
    expect(item('r1')).toHaveAttribute('role', 'menuitemradio');
    expect(item('link').localName).toBe('a');
    expect(item('link')).toHaveAttribute('role', 'menuitem');
    const group = byTestId('group')!;
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-labelledby', byTestId('group-label')!.id);
    expect(byTestId('radio-group')).toHaveAttribute('role', 'group');
  });

  test('each part gives its attributes to its element one time, and its template ref has the element', async () => {
    const { exposed } = mount(MenuEachPart);
    const { refs } = exposed as { refs: Record<string, { element?: Element | null } | null> };
    const names = [
      'Trigger',
      'Backdrop',
      'Positioner',
      'Popup',
      'Arrow',
      'Viewport',
      'List',
      'Item',
      'LinkItem',
      'CheckboxItem',
      'RadioGroup',
      'RadioItem',
      'Group',
      'GroupLabel',
      'SubmenuTrigger',
      'Input',
      'Clear',
      'Empty',
    ];
    await waitFor(() => expect(names.filter((name) => !refs[name]?.element)).toEqual([]));
    expect(names.filter((name) => refs[name]?.element?.getAttribute('class') !== 'part')).toEqual(
      [],
    );
  });

  test('a popup, a `List` or a label that leaves while the menu is open leaves no name of it', async () => {
    const shown = reactive<Record<string, boolean>>({});
    const { trigger } = await mountMenu({ list: {}, group: {}, shown });
    await userEvent.click(trigger);
    await placed();
    expect(trigger).toHaveAttribute('aria-controls', byTestId('list')!.id);
    expect(byTestId('group')).toHaveAttribute('aria-labelledby', byTestId('group-label')!.id);
    shown.list = false;
    shown.label = false;
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', popup()!.id);
    expect(byTestId('group')).not.toHaveAttribute('aria-labelledby');
    shown.popup = false;
    await nextTick();
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  test('a `List` has the role and the name of the menu, and the popup is presentation', async () => {
    const { trigger } = await mountMenu({ list: {}, root: { orientation: 'horizontal' } });
    await userEvent.click(trigger);
    const element = await opened();
    const list = byTestId('list')!;
    expect(element).toHaveAttribute('role', 'presentation');
    expect(element).not.toHaveAttribute('aria-labelledby');
    expect(list).toHaveAttribute('role', 'menu');
    expect(list).toHaveAttribute('aria-labelledby', trigger.id);
    expect(list).toHaveAttribute('aria-orientation', 'horizontal');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
    await waitFor(() => expect(active()).toBe(list));
  });

  test('`aria-label` of the developer names the popup in place of the trigger', async () => {
    const { trigger } = await mountMenu({ popup: { 'aria-label': 'Actions' } });
    await userEvent.click(trigger);
    expect(await opened()).not.toHaveAttribute('aria-labelledby');
  });

  test('the slot of a checkbox item and of a radio item has `state.checked`', async () => {
    const { trigger } = await mountMenu({
      checkbox: { defaultChecked: true },
      radio: { group: { defaultValue: 'r2' } },
    });
    await userEvent.click(trigger);
    await opened();
    expect(item('checkbox')).toHaveTextContent('Checkbox true');
    expect(item('r1')).toHaveTextContent('r1 false');
    expect(item('r2')).toHaveTextContent('r2 true');
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
  });

  test('a group follows a new `id` of its label', async () => {
    const label = reactive<Props>({ id: 'first' });
    const { trigger } = await mountMenu({ group: { label } });
    await userEvent.click(trigger);
    await opened();
    expect(byTestId('group')).toHaveAttribute('aria-labelledby', 'first');
    label.id = 'second';
    await nextTick();
    expect(byTestId('group')).toHaveAttribute('aria-labelledby', 'second');
  });

  test('`as` renders the tag; a trigger in a `<span>` is a button with a tab stop', async () => {
    const { trigger } = await mountMenu({ trigger: { as: 'span' }, popup: { as: 'section' } });
    expect(trigger.localName).toBe('span');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('tabindex', '0');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect((await opened()).localName).toBe('section');
  });
});

describe('the root', () => {
  test('a mouse press opens the menu at `pointerdown` and closes it at `pointerdown`; openChange comes before update:open', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log) });
    const point = centerOf(trigger);
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await opened();
    expect(log).toEqual(['openChange true trigger-press', 'update true']);
    await userEvent.pointer('[/MouseLeft]');
    expect(popup()).not.toBe(null);
    await userEvent.pointer('[MouseLeft>]');
    await closed();
    await userEvent.pointer('[/MouseLeft]');
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false trigger-press',
      'update false',
    ]);
  });

  test('`cancel()` keeps the menu closed; a controlled root shows only what the parent writes', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: false });
    root.onOpenChange = (open: boolean, details: MenuRootChangeEventDetails) => {
      log.push(`openChange ${open}`);
      if (open && log.length === 1) details.cancel();
    };
    const { trigger } = await mountMenu({ root });
    await userEvent.click(trigger);
    await nextTick();
    expect(log).toEqual(['openChange true']);
    await userEvent.click(trigger);
    await nextTick();
    expect(log).toEqual(['openChange true', 'openChange true', 'update true']);
    expect(popup()).toBe(null);
    root.open = true;
    await opened();
  });

  test('the template ref closes the menu with `imperative-action`', async () => {
    const log: string[] = [];
    const { exposed } = await mountMenu({ root: rootEvents(log, { defaultOpen: true }) });
    await opened();
    exposed.root.close();
    await closed();
    expect(log).toEqual(['openChange false imperative-action', 'update false']);
  });

  test('a disabled root disables its trigger and opens nothing', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log, { disabled: true }) });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger, { force: true });
    expect(log).toEqual([]);
  });

  test('itemHighlighted gives the element, the reason, the event and the label', async () => {
    const events: [string | undefined, string, string | undefined, string | undefined][] = [];
    const { trigger } = await mountMenu({
      root: {
        onItemHighlighted: (
          element: HTMLElement | undefined,
          details: { reason: string; event: Event | undefined; label: string | undefined },
        ) =>
          events.push([
            element?.getAttribute('data-key') ?? undefined,
            details.reason,
            details.event?.type,
            details.label,
          ]),
      },
      items: [{ key: 'a', attrs: { label: 'Apple' } }, { key: 'b' }],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.hover(item('a'));
    await waitFor(() => expect(events.length).toBe(3));
    expect(events).toEqual([
      ['a', 'keyboard', undefined, 'Apple'],
      ['b', 'keyboard', 'keydown', 'b'],
      ['a', 'pointer', 'pointermove', 'Apple'],
    ]);
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(events.at(-1)).toEqual([undefined, 'none', undefined, undefined]));
  });

  test('a handle opens the menu of a trigger outside the root, closes it, and says that it is open', async () => {
    const handle = Menu.createHandle();
    expect(handle).toBeInstanceOf(Menu.Handle);
    const { trigger } = await mountMenu({
      root: { handle },
      trigger: { id: 'detached', handle },
    });
    handle.open('detached');
    await opened();
    expect(handle.isOpen).toBe(true);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    handle.close();
    await closed();
    expect(handle.isOpen).toBe(false);
  });
});

describe('the trigger', () => {
  test.each([
    { key: '{Enter}', first: 'a' },
    { key: ' ', first: 'a' },
    { key: '{ArrowDown}', first: 'a' },
    { key: '{ArrowUp}', first: 'c' },
  ])('$key opens the menu and highlights an item', async ({ key, first }) => {
    const { trigger } = await mountMenu();
    trigger.focus();
    await userEvent.keyboard(key);
    await opened();
    await waitFor(() => expect(active()).toBe(item(first)));
    expect(item(first)).toHaveAttribute('data-highlighted');
    expect(item(first)).toHaveAttribute('tabindex', '0');
  });

  test('a key click gives the instant `click`, and Escape gives `dismiss`', async () => {
    const { trigger } = await mountMenu();
    await openWithKeyboard(trigger);
    expect(popup()).toHaveAttribute('data-instant', 'click');
    const element = popup()!;
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(element).toHaveAttribute('data-instant', 'dismiss');
    expect(active()).toBe(trigger);
  });

  test('the open keys prevent their default; a prevented key opens nothing', async () => {
    const { trigger: element } = await mountMenu();
    element.focus();
    const stop = (event: KeyboardEvent) => event.preventDefault();
    element.addEventListener('keydown', stop, { capture: true });
    await userEvent.keyboard('{ArrowDown}');
    element.removeEventListener('keydown', stop, { capture: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).toBe(null);
    let down: KeyboardEvent | undefined;
    element.addEventListener('keydown', (event) => (down ??= event));
    await userEvent.keyboard('{ArrowDown}');
    expect(down?.defaultPrevented).toBe(true);
    await opened();
  });

  test('a click with no press, as `click()` gives, opens the menu', async () => {
    const { trigger } = await mountMenu();
    trigger.click();
    await opened();
  });

  test.skipIf(server.browser !== 'chromium')(
    'after a key open and a close, a tap opens the menu with no highlight',
    async () => {
      const { trigger } = await mountMenu();
      await openWithKeyboard(trigger);
      await userEvent.keyboard('{Escape}');
      await closed();
      await touchDrag(centerOf(trigger), centerOf(trigger), 0);
      await opened();
      await placed();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector('[data-highlighted]')).toBe(null);
    },
  );

  test('`data-pressed` marks a trigger that a press opened', async () => {
    const { trigger } = await mountMenu();
    await userEvent.click(trigger);
    await opened();
    expect(trigger).toHaveAttribute('data-pressed', '');
  });

  test('with `openOnHover`, a mouse that rests on the trigger opens the menu, and the popup takes no focus', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 0 } });
    trigger.focus();
    await userEvent.hover(trigger);
    await opened();
    expect(active()).toBe(trigger);
    expect(document.querySelector(BLOCK)).toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
  });
});

describe('press, drag, release', () => {
  test('the release on an item 200 ms after the press clicks the item', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      root: rootEvents(log),
      items: [{ key: 'a' }, { key: 'b', attrs: { onClick: () => log.push('click b') } }],
    });
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await opened();
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.pointer([{ coords: centerOf(item('b')) }, '[/MouseLeft]']);
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false item-press',
      'update false',
      'click b',
    ]);
  });

  test('the drag ends at its release: a later click on an item gives one click', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', attrs: { closeOnClick: false, onClick: () => clicks.push('a') } },
        { key: 'b', attrs: { closeOnClick: false, onClick: () => clicks.push('b') } },
      ],
    });
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.pointer([{ coords: centerOf(item('a')) }, '[/MouseLeft]']);
    expect(clicks).toEqual(['a']);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.click(item('b'));
    expect(clicks).toEqual(['a', 'b']);
  });

  test('a release at the point of the press keeps the menu open when the trigger moved at the open (VUE-68)', async () => {
    const style = reactive<Props>({ style: 'margin-left: 0' });
    const { trigger } = await mountMenu({
      trigger: style,
      root: { onOpenChange: (open: boolean) => (style.style = `margin-left: ${open ? 200 : 0}px`) },
    });
    const point = centerOf(trigger);
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await placed();
    expect(document.elementFromPoint(point.x, point.y)).not.toBe(trigger);
    await userEvent.pointer('[/MouseLeft]');
    expect(popup()).not.toBe(null);
  });

  test('a release on the trigger, in the popup, or within 8 px of the press keeps the menu open; a release outside closes it with `cancel-open`', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log) });
    const point = centerOf(trigger);
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await placed();
    await userEvent.pointer([{ coords: { x: point.x + 6, y: point.y + 6 } }, '[/MouseLeft]']);
    expect(popup()).not.toBe(null);
    await userEvent.pointer('[MouseLeft>]');
    await closed();
    await userEvent.pointer('[/MouseLeft]');
    log.length = 0;
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await placed();
    await userEvent.pointer([{ coords: centerOf(popup()!) }, { coords: { x: 2, y: 600 } }]);
    await userEvent.pointer('[/MouseLeft]');
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false cancel-open',
      'update false',
    ]);
  });
});

describe('the keys of the list', () => {
  test('the arrow keys loop, Home and End go to the ends, and a disabled item keeps the highlight', async () => {
    const { trigger } = await mountMenu({
      items: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }, { key: 'c' }],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('b'));
    expect(item('b')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(active()).toBe(item('a'));
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('c'));
    await userEvent.keyboard('{Home}');
    expect(active()).toBe(item('a'));
    await userEvent.keyboard('{End}');
    expect(active()).toBe(item('c'));
  });

  test('with `loopFocus` false, an arrow key at an end keeps the highlight', async () => {
    const { trigger } = await mountMenu({ root: { loopFocus: false } });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('a'));
  });

  test('a horizontal menu moves with the left and right keys, in the direction of its popup', async () => {
    const { trigger } = await mountMenu({
      root: { orientation: 'horizontal' },
      positioner: { dir: 'rtl' },
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('a')));
    expect(popup()).toHaveAttribute('aria-orientation', 'horizontal');
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(item('b'));
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(item('a'));
  });

  test('a `keydown` listener on an item that calls `preventDefault()` stops the list', async () => {
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', attrs: { onKeydown: (event: KeyboardEvent) => event.preventDefault() } },
        { key: 'b' },
      ],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('a'));
  });

  test('the typeahead goes on from the highlight, keeps a match that still fits, and ends 500 ms after the last key', async () => {
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', text: 'Banana' },
        { key: 'b', text: 'Apple' },
        { key: 'c', text: 'Apricot' },
        { key: 'd', text: 'Avocado' },
      ],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('a');
    expect(active()).toBe(item('b'));
    await userEvent.keyboard('p');
    expect(active()).toBe(item('b'));
    await userEvent.keyboard('r');
    expect(active()).toBe(item('c'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('a');
    expect(active()).toBe(item('d'));
    // No text starts with a double letter: the same key goes to the next item with the letter.
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('aa');
    expect(active()).toBe(item('c'));
  });

  test('a Space before any letter is no character of the typed string', async () => {
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', text: 'Apple' },
        { key: 'b', text: 'Banana' },
      ],
    });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(popup()));
    await userEvent.keyboard(' b');
    expect(item('b')).toHaveAttribute('data-highlighted');
  });

  test('a root that becomes disabled while it is open takes no key', async () => {
    const root = reactive<Props>({});
    const { trigger } = await mountMenu({ root });
    await openWithKeyboard(trigger);
    root.disabled = true;
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('a'));
  });

  test('a key open, a close and a press: the press opens the menu with no highlight', async () => {
    const { trigger } = await mountMenu();
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(popup()));
    expect(document.querySelector('[data-highlighted]')).toBe(null);
  });

  test('Space is a character of the typed string, and gives no click', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      root: rootEvents(log),
      items: [
        { key: 'a', text: 'Open' },
        { key: 'b', text: 'Open file' },
        { key: 'c', text: 'Open folder', attrs: { onClick: () => log.push('click c') } },
      ],
    });
    await openWithKeyboard(trigger);
    log.length = 0;
    await userEvent.keyboard('open f');
    expect(active()).toBe(item('b'));
    await userEvent.keyboard('o');
    expect(active()).toBe(item('c'));
    expect(log).toEqual([]);
  });

  test('a pointer move highlights an item and gives it the focus; a leave to no item gives the focus to the popup', async () => {
    const { trigger } = await mountMenu();
    await userEvent.click(trigger);
    const element = await opened();
    await placed();
    await userEvent.hover(item('b'));
    await waitFor(() => expect(active()).toBe(item('b')));
    expect(item('b')).toHaveAttribute('data-highlighted');
    const rect = element.getBoundingClientRect();
    await userEvent.pointer({ coords: { x: rect.right + 40, y: rect.bottom + 40 } });
    await waitFor(() => expect(active()).toBe(element));
    expect(item('b')).not.toHaveAttribute('data-highlighted');
  });

  test('with `highlightItemOnHover` false, the pointer highlights nothing', async () => {
    const { trigger } = await mountMenu({ root: { highlightItemOnHover: false } });
    await userEvent.click(trigger);
    await placed();
    await userEvent.hover(item('b'));
    await nextTick();
    expect(item('b')).not.toHaveAttribute('data-highlighted');
    // A key gives the highlight, and a pointer that leaves another item keeps it.
    item('a').focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(item('c')).toHaveAttribute('data-highlighted');
    await userEvent.hover(item('a'));
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    expect(item('c')).toHaveAttribute('data-highlighted');
  });

  test('a menu that opens under a pointer that rests highlights nothing', async () => {
    const { trigger } = await mountMenu({ root: { defaultOpen: false } });
    trigger.focus();
    // The pointer rests where the first item will be.
    const rect = trigger.getBoundingClientRect();
    await userEvent.pointer({ coords: { x: rect.left + 10, y: rect.bottom + 12 } });
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{ArrowDown}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(item('b'));
  });
});

describe('the focus', () => {
  test('Tab closes the menu and moves the focus to the next tab stop after the trigger', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log) });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(active()?.id).toBe('after');
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false focus-out',
      'update false',
    ]);
  });

  test('Shift+Tab closes the menu and moves the focus to the trigger; a listener that cancels the close does not stop the move (VUE-69)', async () => {
    const log: string[] = [];
    const root = rootEvents(log);
    const { trigger } = await mountMenu({ root });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await closed();
    expect(active()).toBe(trigger);
    root.onOpenChange = (open: boolean, details: MenuRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      if (!open) details.cancel();
    };
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(active()).toBe(trigger));
    expect(popup()).not.toBe(null);
  });

  test('when the focused item leaves the DOM, the popup takes the focus and the arrow keys still work', async () => {
    const items = reactive([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
    const { trigger } = await mountMenu({ items });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('b'));
    items.splice(1, 1);
    await waitFor(() => expect(active()).toBe(popup()));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('a'));
  });

  test('`finalFocus` gives the element of the focus at the close', async () => {
    const { trigger } = await mountMenu({
      popup: { finalFocus: () => document.getElementById('before') },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(active()?.id).toBe('before');
  });
});

describe('the items', () => {
  test('a click on an item closes the menu with `item-press`; `closeOnClick` false keeps it open', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      root: rootEvents(log),
      items: [{ key: 'a', attrs: { closeOnClick: false } }, { key: 'b' }],
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('a'));
    expect(popup()).not.toBe(null);
    await userEvent.click(item('b'));
    await closed();
    expect(log.slice(2)).toEqual(['openChange false item-press', 'update false']);
  });

  test('a disabled item gets no click; Enter and Space on an item give one click', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', attrs: { closeOnClick: false, onClick: () => clicks.push('a') } },
        { key: 'b', attrs: { disabled: true, onClick: () => clicks.push('b') } },
      ],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Enter} ');
    expect(clicks).toEqual(['a', 'a']);
    await userEvent.keyboard('{ArrowDown}{Enter} ');
    await userEvent.click(item('b'), { force: true });
    expect(clicks).toEqual(['a', 'a']);
  });

  test('a checkbox item toggles at a click and emits checkedChange, then update:modelValue; a cancel keeps it', async () => {
    const log: string[] = [];
    const checkbox = reactive<Props>({
      onCheckedChange: (checked: boolean, details: { reason: string; cancel(): void }) => {
        log.push(`checkedChange ${checked} ${details.reason}`);
        if (log.length > 2) details.cancel();
      },
      'onUpdate:modelValue': (checked: boolean) => log.push(`update ${checked}`),
    });
    const { trigger } = await mountMenu({ checkbox });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('checkbox'));
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(popup()).not.toBe(null);
    await userEvent.click(item('checkbox'));
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(log).toEqual([
      'checkedChange true item-press',
      'update true',
      'checkedChange false item-press',
    ]);
  });

  test('with `closeOnClick`, a checkbox item, a radio item and a link item close the menu with `item-press`', async () => {
    const cases: [Props, string][] = [
      [{ checkbox: { closeOnClick: true } }, 'checkbox'],
      [{ radio: { items: { closeOnClick: true } } }, 'r2'],
      [
        { link: { closeOnClick: true, onClick: (event: MouseEvent) => event.preventDefault() } },
        'link',
      ],
    ];
    for (const [setup, key] of cases) {
      const log: string[] = [];
      const { trigger, unmount } = await mountMenu({ root: rootEvents(log), ...setup });
      await userEvent.click(trigger);
      await placed();
      await userEvent.click(item(key));
      await closed();
      expect(log, key).toContain('openChange false item-press');
      unmount();
    }
  });

  test('a radio group emits update:modelValue after valueChange; a cancel keeps the value; its label names it; `disabled` gives `aria-disabled`', async () => {
    const log: string[] = [];
    const group = reactive<Props>({
      defaultValue: 'r1',
      onValueChange: (value: string, details: { cancel(): void }) => {
        log.push(`valueChange ${value}`);
        if (value === 'r3') details.cancel();
      },
      'onUpdate:modelValue': (value: string) => log.push(`update ${value}`),
    });
    const { trigger } = await mountMenu({ radio: { group, label: true } });
    await userEvent.click(trigger);
    await placed();
    expect(byTestId('radio-group')).toHaveAttribute('aria-labelledby', byTestId('radio-label')!.id);
    expect(byTestId('radio-group')).not.toHaveAttribute('aria-disabled');
    await userEvent.click(item('r2'));
    await userEvent.click(item('r3'));
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
    expect(log).toEqual(['valueChange r2', 'update r2', 'valueChange r3']);
    group.disabled = true;
    await nextTick();
    expect(byTestId('radio-group')).toHaveAttribute('aria-disabled', 'true');
  });

  test('a radio item checks its value; a press of the checked item emits nothing', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      radio: {
        group: {
          defaultValue: 'r1',
          onValueChange: (value: string, details: { reason: string }) =>
            log.push(`valueChange ${value} ${details.reason}`),
        },
      },
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('r1'));
    await userEvent.click(item('r2'));
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
    expect(item('r1')).toHaveAttribute('aria-checked', 'false');
    expect(log).toEqual(['valueChange r2 item-press']);
  });

  test('Enter follows a link item, and Space gives it one click', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountMenu({
      items: [],
      link: {
        onClick: (event: MouseEvent) => {
          clicks.push('link');
          event.preventDefault();
        },
      },
    });
    await openWithKeyboard(trigger).catch(() => undefined);
    item('link').focus();
    let space: KeyboardEvent | undefined;
    item('link').addEventListener('keydown', (event) => (space ??= event));
    await userEvent.keyboard(' ');
    // The page does not scroll for the Space.
    expect(space?.defaultPrevented).toBe(true);
    expect(clicks).toEqual(['link']);
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual(['link', 'link']);
    // A Space that went down on another element gives no click at its release on the link.
    item('link').dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    expect(clicks).toEqual(['link', 'link']);
  });
});

describe('submenus', () => {
  const submenu = (extra: Props = {}) => ({
    submenu: { trigger: { delay: 0 }, ...extra },
  });

  test('a pointer move on the submenu trigger opens the submenu; the trigger names and controls it', async () => {
    const { trigger } = await mountMenu(submenu());
    await userEvent.click(trigger);
    await placed();
    expect(item('sub')).toHaveAttribute('aria-haspopup', 'menu');
    expect(item('sub')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.hover(item('sub'));
    const element = await opened(subPopup);
    expect(item('sub')).toHaveAttribute('role', 'menuitem');
    expect(item('sub')).toHaveAttribute('aria-controls', element.id);
    expect(item('sub')).toHaveAttribute('data-popup-open');
    expect(element).toHaveAttribute('aria-labelledby', item('sub').id);
    // A submenu opens at the inline end of its trigger.
    const subRect = element.getBoundingClientRect();
    expect(subRect.left).toBeGreaterThanOrEqual(item('sub').getBoundingClientRect().right - 1);
  });

  test('the arrow key across the menu opens the submenu with its first item, and the other one closes it and gives the focus back', async () => {
    const { trigger } = await mountMenu(submenu());
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}');
    expect(active()).toBe(item('sub'));
    await userEvent.keyboard('{ArrowRight}');
    await opened(subPopup);
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('s2'));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    expect(active()).toBe(item('sub'));
    expect(item('sub')).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('s1')));
  });

  test('Escape closes the submenu only; with `closeParentOnEsc` it closes the parent too', async () => {
    const { trigger } = await mountMenu(submenu());
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Escape}');
    await closed(subPopup);
    expect(popup()).not.toBe(null);
    expect(active()).toBe(item('sub'));
  });

  test('with `closeParentOnEsc`, Escape in the submenu closes each menu', async () => {
    const { trigger } = await mountMenu(submenu({ root: { closeParentOnEsc: true } }));
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(active()).toBe(trigger);
  });

  test('a click on an item of the submenu closes each menu, with one openChange for each', async () => {
    const log: string[] = [];
    const sub: string[] = [];
    const { trigger } = await mountMenu({
      root: rootEvents(log),
      submenu: {
        trigger: { delay: 0 },
        root: {
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            sub.push(`${open} ${details.reason}`),
        },
      },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Enter}');
    await closed();
    expect(log.slice(2)).toEqual(['openChange false item-press', 'update false']);
    expect(sub).toEqual(['true list-navigation', 'false item-press']);
    expect(active()).toBe(trigger);
  });

  test('a submenu that opens closes its sibling with `sibling-open`', async () => {
    const sub: string[] = [];
    const { trigger } = await mountMenu({
      submenu: {
        trigger: { delay: 0 },
        root: {
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            sub.push(`${open} ${details.reason}`),
        },
      },
      sibling: { trigger: { delay: 0 } },
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await userEvent.hover(item('sibling'));
    await opened(() => byTestId('sibling-popup'));
    await closed(subPopup);
    expect(sub).toEqual(['true trigger-hover', 'false sibling-open']);
    // The closed submenu gives no focus back to its trigger.
    expect(item('sibling')).toHaveAttribute('data-highlighted');
    expect(active()).toBe(item('sibling'));
  });

  test('a submenu that the pointer entered stays open when the pointer leaves it; a new hover starts again', async () => {
    const { trigger } = await mountMenu(submenu());
    await userEvent.click(trigger);
    await placed();
    const corner = { x: 2, y: window.innerHeight - 2 };
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await userEvent.hover(item('s1'));
    await userEvent.pointer({ coords: corner });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(subPopup()).not.toBe(null);
    // The trigger keeps the highlight of the parent while the pointer is in the submenu.
    expect(item('sub')).toHaveAttribute('data-highlighted');
    item('s1').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await userEvent.pointer({ coords: corner });
    await closed(subPopup);
  });

  test('a key across the menu on the trigger of a submenu that a hover opened highlights its first item; the next hover highlights nothing', async () => {
    const { trigger } = await mountMenu(submenu());
    await userEvent.click(trigger);
    await placed();
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await waitFor(() => expect(active()).toBe(item('sub')));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    await userEvent.hover(item('a'));
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(item('s1')).not.toHaveAttribute('data-highlighted');
  });

  test('the keys of an open submenu: an arrow key in the parent keeps it open; Ctrl+ArrowRight opens no submenu; the keys that open and close it prevent their default', async () => {
    const { trigger } = await mountMenu(submenu());
    await openWithKeyboard(trigger);
    const keys: KeyboardEvent[] = [];
    const record = (event: KeyboardEvent) => keys.push(event);
    document.addEventListener('keydown', record);
    try {
      await userEvent.keyboard('{End}{Control>}{ArrowRight}{/Control}');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(subPopup()).toBe(null);
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => expect(active()).toBe(item('s1')));
      await userEvent.keyboard('{ArrowLeft}');
      await closed(subPopup);
    } finally {
      document.removeEventListener('keydown', record);
    }
    const prevented = (key: string) =>
      keys.filter((event) => event.key === key).at(-1)?.defaultPrevented;
    expect(prevented('ArrowRight')).toBe(true);
    expect(prevented('ArrowLeft')).toBe(true);
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    item('sub').focus();
    await userEvent.keyboard('{ArrowUp}');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(subPopup()).not.toBe(null);
  });

  test('a canceled close of the parent keeps its submenu open; a close by the parent of the root closes it with an event', async () => {
    const sub: string[] = [];
    const root = reactive<Props>({
      open: true,
      onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) => {
        if (!open) details.cancel();
      },
    });
    const { exposed } = await mountMenu({
      root,
      submenu: {
        trigger: { delay: 0 },
        root: {
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            sub.push(`${open} ${details.reason}`),
        },
      },
    });
    await placed();
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    (exposed as { root: { close(): void } }).root.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(subPopup()).not.toBe(null);
    root.open = false;
    await closed();
    expect(sub).toEqual(['true trigger-hover', 'false sibling-open']);
  });

  test('a mouse press on a submenu trigger that opens on hover does nothing; with `openOnHover` false it toggles', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { openOnHover: false } } });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('sub'));
    await opened(subPopup);
    // A submenu that a press opened leaves the focus on its trigger.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(item('sub'));
    await userEvent.click(item('sub'));
    await closed(subPopup);
  });

  test('Tab in a submenu closes each menu; Shift+Tab closes the submenu only and gives the focus to its trigger', async () => {
    const { trigger } = await mountMenu(submenu());
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await closed(subPopup);
    expect(active()).toBe(item('sub'));
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(active()?.id).toBe('after');
  });

  test('a submenu in a submenu: the parent closes each submenu above it', async () => {
    const { trigger } = await mountMenu(submenu({ nested: { trigger: { delay: 0 } } }));
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('d1')));
    await userEvent.pointer([
      { coords: centerOf(document.getElementById('outside')!) },
      '[MouseLeft]',
    ]);
    await closed();
    expect(byTestId('deep-popup')).toBe(null);
  });
});

describe('the layer', () => {
  test('a modal menu blocks the page and locks the scroll; the trigger keeps its hover', async () => {
    const { trigger } = await mountMenu();
    await userEvent.click(trigger);
    await placed();
    await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
    expect(isScrollLocked()).toBe(true);
    expect(document.elementFromPoint(centerOf(trigger).x, centerOf(trigger).y)).toBe(trigger);
  });

  test('`modal` false blocks nothing', async () => {
    const { trigger } = await mountMenu({ root: { modal: false } });
    await userEvent.click(trigger);
    await placed();
    expect(document.querySelector(BLOCK)).toBe(null);
    expect(isScrollLocked()).toBe(false);
  });

  test('a press of the right button outside closes the menu at the press', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log, { modal: false }) });
    const outside = document.getElementById('outside')!;
    outside.addEventListener('contextmenu', (event) => event.preventDefault());
    await userEvent.click(trigger);
    await placed();
    await userEvent.pointer([{ coords: centerOf(outside) }, '[MouseRight>]']);
    await closed();
    await userEvent.pointer('[/MouseRight]');
    expect(log.slice(2)).toEqual(['openChange false outside-press', 'update false']);
  });
});

describe('the positioner', () => {
  test('a menu opens under its trigger at its center; the state names its side and its place', async () => {
    const { trigger } = await mountMenu();
    await userEvent.click(trigger);
    await placed();
    const positioner = byTestId('positioner')!;
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(positioner).toHaveAttribute('data-align', 'center');
    expect(popup()).toHaveAttribute('data-side', 'bottom');
    expect(popup()).toHaveAttribute('data-align', 'center');
    expect(positioner).not.toHaveAttribute('data-anchor-hidden');
    const box = positioner.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom - 1);
  });
});

describe('the arrow and the anchor', () => {
  const arrow = { style: 'width: 10px; height: 10px' };
  const centerX = (element: Element) => centerOf(element).x;

  test('the arrow points to the center of the trigger', async () => {
    const { trigger } = await mountMenu({ arrow });
    await userEvent.click(trigger);
    await placed();
    const element = byTestId('arrow')!;
    await waitFor(() => expect(Math.abs(centerX(element) - centerX(trigger))).toBeLessThan(1));
    expect(element).toHaveAttribute('data-align', 'center');
    expect(element).not.toHaveAttribute('data-uncentered');
  });

  test('an arrow that cannot point to the center of a narrow trigger at the edge has `data-uncentered`', async () => {
    const { trigger } = await mountMenu({
      arrow,
      trigger: { style: 'position: fixed; left: 0; top: 40px; width: 2px; padding: 0; border: 0' },
    });
    await userEvent.click(trigger);
    await placed();
    await waitFor(() => expect(byTestId('arrow')).toHaveAttribute('data-uncentered'));
  });

  test('the positioner has `data-anchor-hidden` while the trigger is out of view', async () => {
    const { trigger } = await mountMenu({ root: { modal: false } });
    const spacer = document.body.appendChild(document.createElement('div'));
    spacer.style.height = '3000px';
    try {
      await userEvent.click(trigger);
      await placed();
      window.scrollTo(0, 2000);
      await waitFor(() => expect(byTestId('positioner')).toHaveAttribute('data-anchor-hidden'));
    } finally {
      window.scrollTo(0, 0);
      spacer.remove();
    }
  });
});

describe('the viewport', () => {
  test('a move to another trigger gives the direction, the size of the popup, and `data-instant`', async () => {
    mount(MenuViewportParts);
    await nextTick();
    await userEvent.click(document.getElementById('one')!);
    const element = await opened();
    await placed();
    const sizes: string[] = [];
    const observer = new MutationObserver(() => {
      const size = element.style.getPropertyValue('--popup-height');
      if (size) sizes.push(size);
    });
    observer.observe(element, { attributes: true });
    try {
      await userEvent.click(document.getElementById('two')!);
      await waitFor(() =>
        expect(byTestId('viewport')).toHaveAttribute('data-activation-direction', 'right '),
      );
      await waitFor(() =>
        expect(byTestId('viewport')).toHaveAttribute('data-instant', 'trigger-change'),
      );
    } finally {
      observer.disconnect();
    }
    expect(sizes).not.toEqual([]);
  });
});

describe('more behaviors of the parts', () => {
  test('an `id` of white space counts as no `id`', async () => {
    const { trigger } = await mountMenu({ trigger: { id: '  ' } });
    expect(trigger.id.trim()).not.toBe('');
    await userEvent.click(trigger);
    expect(await opened()).toHaveAttribute('aria-labelledby', trigger.id);
  });

  test('a trigger in a disabled fieldset is disabled', async () => {
    const { trigger } = await mountMenu({ fieldset: true });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('true');
  });

  test('with `keepMounted`, the closed popup and backdrop stay with `hidden` and `inert`', async () => {
    const { trigger } = await mountMenu({ portal: { keepMounted: true }, backdrop: {} });
    await nextTick();
    const element = popup()!;
    expect(element).toHaveAttribute('hidden');
    expect(element).toHaveAttribute('inert');
    expect(byTestId('backdrop')).toHaveAttribute('hidden');
    expect(byTestId('backdrop')).toHaveAttribute('inert');
    await userEvent.click(trigger);
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(popup()).toBe(element);
  });

  test('the backdrop and the arrow have their roles', async () => {
    const { trigger } = await mountMenu({ backdrop: {}, arrow: {} });
    await userEvent.click(trigger);
    await placed();
    expect(byTestId('backdrop')).toHaveAttribute('role', 'presentation');
    expect(byTestId('arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(byTestId('arrow')).toHaveAttribute('data-side', 'bottom');
  });

  test('an arrow key of a horizontal parent that the submenu did not use closes the submenu and moves the highlight of the parent', async () => {
    const { trigger } = await mountMenu({
      root: { orientation: 'horizontal' },
      submenu: { trigger: { delay: 0 } },
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{End}');
    expect(active()).toBe(item('sub'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowRight}');
    await closed(subPopup);
    expect(active()).toBe(item('a'));
  });

  test('a pointer move to another item closes the open submenu with `sibling-open`, and a move back to its trigger keeps it', async () => {
    const sub: string[] = [];
    const { trigger } = await mountMenu({
      submenu: {
        trigger: { delay: 0, closeDelay: 400 },
        root: {
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            sub.push(`${open} ${details.reason}`),
        },
      },
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    // A move from the trigger up and away from the submenu, outside the triangle.
    const away = async () => {
      const box = item('sub').getBoundingClientRect();
      await userEvent.pointer([
        { coords: { x: box.left + 10, y: box.top - 2 } },
        { coords: centerOf(item('a')) },
      ]);
    };
    await away();
    await userEvent.hover(item('sub'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(subPopup()).not.toBe(null);
    await away();
    await closed(subPopup);
    expect(sub).toEqual(['true trigger-hover', 'false sibling-open']);
  });

  test('a submenu leaves in its `<Transition>` when its parent closes, and then the parent leaves', async () => {
    mount(MenuInTransition, { root: { closeParentOnEsc: false } });
    await nextTick();
    byTestId('trigger')!.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    const sub = subPopup()!;
    const parent = popup()!;
    await userEvent.pointer([{ coords: { x: 2, y: 600 } }, '[MouseLeft]']);
    await waitFor(() => expect(sub).toHaveClass('menu-fade-leave-active'));
    // The parent stays until the submenu left, and then leaves.
    expect(parent.isConnected).toBe(true);
    expect(parent).not.toHaveAttribute('hidden');
    await waitFor(() => expect(sub.isConnected).toBe(false));
    await waitFor(() => expect(parent).toHaveClass('menu-fade-leave-active'));
    await waitFor(() => expect(parent.isConnected).toBe(false));
  });
});

describe('a menu and a popover', () => {
  test('a click on an item of a menu in a popover closes the menu and keeps the popover', async () => {
    mount(MenuInPopover, { popover: { defaultOpen: true } });
    await waitFor(() => expect(byTestId('popover-popup')).not.toBe(null));
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await placed();
    await userEvent.click(item('a'));
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
  });

  test('a press in a popover in a menu keeps the menu open', async () => {
    mount(MenuInPopover, { popover: { defaultOpen: true } });
    await waitFor(() => expect(byTestId('popover-popup')).not.toBe(null));
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await placed();
    await userEvent.click(byTestId('inner-trigger')!);
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await userEvent.click(byTestId('inner-button')!);
    expect(popup()).not.toBe(null);
    expect(byTestId('inner-popup')).not.toBe(null);
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its parent', () => {
  test('Backdrop and Positioner with no Portal throw an error that names the part', () => {
    expect(String(mountError(MenuPartAlone, { part: 'Backdrop' }))).toContain(
      '<Menu.Backdrop> must be inside <Menu.Portal>',
    );
    expect(String(mountError(MenuPartAlone, { part: 'Positioner' }))).toContain(
      '<Menu.Positioner> must be inside <Menu.Portal>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
