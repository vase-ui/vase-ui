import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Menu, type MenuRootChangeEventDetails } from '@vase-ui/vue/menu';
import { platform } from '../common/platform';
import MenuInPopover from '../../test/fixtures/MenuInPopover.vue';
import MenuInTransition from '../../test/fixtures/MenuInTransition.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import MenuEachPart from '../../test/fixtures/MenuEachPart.vue';
import MenuEachPartSlot from '../../test/fixtures/MenuEachPartSlot.vue';
import MenuGroupLabels from '../../test/fixtures/MenuGroupLabels.vue';
import MenuTriggerHides from '../../test/fixtures/MenuTriggerHides.vue';
import MenuWithDialog from '../../test/fixtures/MenuWithDialog.vue';
import MenuHandleTrigger from '../../test/fixtures/MenuHandleTrigger.vue';
import MenuPartAlone from '../../test/fixtures/MenuPartAlone.vue';
import MenuViewportParts from '../../test/fixtures/MenuViewportParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { holdPress, movePointerThrough, touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { readWhen } from '../../test/wait';
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
async function openWithKeyboard(trigger: HTMLElement, first = 'a') {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await opened();
  await waitFor(() => expect(active()?.getAttribute('data-key')).toBe(first));
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

  test('each part with the `element` slot gives its attributes to the element of the slot, and none to the slot', async () => {
    mount(MenuEachPartSlot);
    await waitFor(() => expect(document.querySelectorAll('.part')).toHaveLength(18));
    expect([...document.querySelectorAll('.part')].map((element) => element.className)).toEqual(
      Array.from({ length: 18 }, () => 'part'),
    );
  });

  test('a popup, a `List` or a label that leaves while the menu is open leaves no name of it', async () => {
    const shown = reactive<Record<string, boolean>>({});
    const { trigger } = await mountMenu({ list: {}, group: {}, shown });
    await userEvent.click(trigger);
    await placed();
    expect(trigger).toHaveAttribute('aria-controls', byTestId('list')!.id);
    expect(byTestId('group')).toHaveAttribute('aria-labelledby', byTestId('group-label')!.id);
    shown.label = false;
    await nextTick();
    expect(byTestId('group')).not.toHaveAttribute('aria-labelledby');
    shown.list = false;
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', popup()!.id);
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

  test('`as` renders the tag; a trigger in a `<span>` is a button with a tab stop; its Enter does not press an item in a `<button>`, which submits no form', async () => {
    const { trigger } = await mountMenu({
      trigger: { as: 'span' },
      popup: { as: 'section' },
      items: [{ key: 'a', attrs: { as: 'button' } }, { key: 'b' }],
    });
    expect(trigger.localName).toBe('span');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('tabindex', '0');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect((await opened()).localName).toBe('section');
    await waitFor(() => expect(active()).toBe(item('a')));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    expect(item('a').localName).toBe('button');
    expect(item('a')).toHaveAttribute('type', 'button');
    expect(item('b')).not.toHaveAttribute('type');
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
    // A typed letter gives its `keydown`.
    await userEvent.keyboard('b');
    await waitFor(() => expect(events.at(-1)).toEqual(['b', 'keyboard', 'keydown', 'b']));
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

  test('the keys on a trigger of a handle that no root uses do nothing', async () => {
    mount(MenuHandleTrigger);
    await nextTick();
    byTestId('trigger')!.focus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(popup()).toBe(null);
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

  test.skipIf(server.browser !== 'chromium')(
    'after an Enter that a listener prevented, a tap opens the menu and the submenu with no highlight',
    async () => {
      const prevent = { onKeydown: (event: KeyboardEvent) => event.preventDefault() };
      const { trigger } = await mountMenu({
        trigger: prevent,
        submenu: { trigger: { ...prevent, openOnHover: false } },
      });
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await touchDrag(centerOf(trigger), centerOf(trigger), 0);
      await placed();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector('[data-highlighted]')).toBe(null);
      item('sub').focus();
      await userEvent.keyboard('{Enter}');
      await touchDrag(centerOf(item('sub')), centerOf(item('sub')), 0);
      await opened(subPopup);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect([...document.querySelectorAll('[data-highlighted]')]).toEqual([item('sub')]);
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

  test('with an `open` that the parent holds, the release on an item 200 ms after the press clicks the item; an open that the parent refuses clicks nothing', async () => {
    const clicks: string[] = [];
    const parent = { accepts: false };
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => {
      if (parent.accepts) root.open = open;
    };
    const { trigger } = await mountMenu({
      root,
      items: [{ key: 'a' }, { key: 'b', attrs: { onClick: () => clicks.push('b') } }],
    });
    const refused = await holdPress(trigger);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await refused.release({ x: refused.point.x, y: refused.point.y + 60 });
    expect(popup()).toBe(null);
    // The trigger takes the focus as a button does.
    const webkitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
    expect(active()).toBe(webkitOnMac ? document.body : trigger);
    parent.accepts = true;
    const press = await holdPress(trigger);
    await opened();
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await press.release(centerOf(item('b')));
    await closed();
    expect(clicks).toEqual(['b']);
  });

  test('a press on another trigger whose open a listener cancels starts no drag: its release on an item of the open menu clicks nothing', async () => {
    const clicks: string[] = [];
    const handle = Menu.createHandle();
    const { trigger } = await mountMenu({
      root: {
        handle,
        modal: false,
        onOpenChange: (_: boolean, details: MenuRootChangeEventDetails) => {
          if (details.trigger === byTestId('detached')) details.cancel();
        },
      },
      trigger: { handle },
      detached: { handle },
      items: [{ key: 'a' }, { key: 'b', attrs: { onClick: () => clicks.push('b') } }],
    });
    await userEvent.click(trigger);
    await opened();
    await placed();
    const press = await holdPress(byTestId('detached')!);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await press.release(centerOf(item('b')));
    expect(popup()).not.toBe(null);
    expect(clicks).toEqual([]);
  });

  test('a press that keeps open a menu that a hover opened gives the trigger the focus and starts no drag: a release outside keeps the menu', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 0 } });
    await userEvent.hover(trigger);
    await opened();
    const press = await holdPress(trigger);
    const webkitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
    expect(active()).toBe(webkitOnMac ? document.body : trigger);
    await press.release({ x: 2, y: window.innerHeight - 2 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
  });

  test('a press that closes a menu that a hover opened moves the focus as a press on a button does', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 0 } });
    await userEvent.hover(trigger);
    await opened();
    // A press closes a menu that a hover opened 500 ms or more before it.
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.pointer({ coords: centerOf(trigger), keys: '[MouseLeft]' });
    await closed();
    const webkitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
    expect(active()).toBe(webkitOnMac ? document.body : trigger);
  });

  test('a press closes the menu, and the trigger keeps the focus', async () => {
    const { trigger } = await mountMenu();
    await userEvent.click(trigger);
    const element = await opened();
    await waitFor(() => expect(active()).toBe(element));
    await userEvent.pointer({ coords: centerOf(trigger), keys: '[MouseLeft]' });
    await closed();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(trigger);
  });

  test('a press closes the menu, and the element of `finalFocus` keeps the focus', async () => {
    const { trigger } = await mountMenu({
      popup: { finalFocus: () => document.getElementById('before') },
    });
    await userEvent.click(trigger);
    const element = await opened();
    await waitFor(() => expect(active()).toBe(element));
    await userEvent.pointer({ coords: centerOf(trigger), keys: '[MouseLeft]' });
    await closed();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()?.id).toBe('before');
  });

  test('a press opens the menu that the parent holds, and the popup keeps the focus', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    const { trigger } = await mountMenu({ root });
    await userEvent.click(trigger);
    const element = await opened();
    await waitFor(() => expect(active()).toBe(element));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(element);
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
    const { point, release } = await holdPress(trigger);
    await placed();
    expect(document.elementFromPoint(point.x, point.y)).not.toBe(trigger);
    await release();
    expect(popup()).not.toBe(null);
  });

  test('a release in the popup but on no item keeps the menu open', async () => {
    const { trigger } = await mountMenu({ list: {} });
    const { release } = await holdPress(trigger);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    const text = [...popup()!.querySelectorAll('span')].find(
      (span) => span.textContent === 'Text',
    )!;
    await release(centerOf(text));
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

  test('a key open highlights the first or the last item that is not disabled; the arrow keys still reach a disabled item', async () => {
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', attrs: { disabled: true } },
        { key: 'b' },
        { key: 'c', attrs: { disabled: true } },
      ],
    });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(active()).toBe(item('b')));
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('a'));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.keyboard('{ArrowUp}');
    await opened();
    await waitFor(() => expect(active()).toBe(item('b')));
  });

  test('an item loses the highlight when the trigger of the open menu takes the focus', async () => {
    const { trigger } = await mountMenu();
    await openWithKeyboard(trigger);
    trigger.focus();
    await nextTick();
    expect(document.querySelector('[data-highlighted]')).toBe(null);
    expect(popup()).not.toBe(null);
  });

  test('an item loses the highlight when another trigger of the open menu takes the focus', async () => {
    mount(MenuViewportParts);
    await nextTick();
    const [one, two] = [document.getElementById('one')!, document.getElementById('two')!];
    one.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(document.querySelector('[data-highlighted]')).not.toBe(null));
    two.focus();
    await nextTick();
    expect(document.querySelector('[data-highlighted]')).toBe(null);
    expect(one).toHaveAttribute('aria-expanded', 'true');
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

  test('a key open, a close and a press: the press opens the menu with no highlight, also with `keepMounted`', async () => {
    const { trigger } = await mountMenu({ portal: { keepMounted: true } });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
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
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The keys of the trigger still reach the open menu, and Escape gives the focus back.
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
    root.onOpenChange = undefined;
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(active()).toBe(trigger);
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
    await openWithKeyboard(trigger, 'link');
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
    // VoiceOver reads a change of `aria-expanded` in place of the first item of the submenu.
    if (platform.os.apple) expect(item('sub')).not.toHaveAttribute('aria-expanded');
    else expect(item('sub')).toHaveAttribute('aria-expanded', 'true');
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

  test('a mouse press on a submenu trigger that opens on hover opens nothing before the delay', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { delay: 1000 } } });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('sub'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(subPopup()).toBe(null);
  });

  test('a submenu trigger with `openOnHover` false: a key on the open submenu highlights its first item, and a later press opens it with no highlight', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { openOnHover: false } } });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{Enter}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    await userEvent.click(item('sub'));
    await opened(subPopup);
    expect(active()).toBe(item('sub'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    await userEvent.click(item('sub'));
    await opened(subPopup);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(item('s1')).not.toHaveAttribute('data-highlighted');
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

  test('a submenu with no portal takes its own keys: a key that it does not use moves nothing in the parent', async () => {
    const { trigger } = await mountMenu(
      submenu({ root: { orientation: 'horizontal' }, portal: { disabled: true } }),
    );
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('s1'));
    expect(item('sub')).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(item('s2'));
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

  test.skipIf(server.browser !== 'chromium').each([
    { width: undefined, locked: false },
    { width: '100vw', locked: true },
  ])(
    'after a tap, the scroll locks only when the popup covers the width of the view: $width',
    async ({ width, locked }) => {
      const { trigger } = await mountMenu({ popup: { style: width && { width } } });
      await touchDrag(centerOf(trigger), centerOf(trigger), 0);
      await placed();
      await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
      expect(isScrollLocked()).toBe(locked);
    },
  );

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
    const { trigger } = await mountMenu({
      arrow,
      positioner: { align: 'start' },
      items: [{ key: 'a', text: 'An item with a long text' }],
    });
    await userEvent.click(trigger);
    await placed();
    const element = byTestId('arrow')!;
    await waitFor(() => expect(Math.abs(centerX(element) - centerX(trigger))).toBeLessThan(1));
    expect(element).toHaveAttribute('data-align', 'start');
    expect(element).not.toHaveAttribute('data-uncentered');
  });

  test('VUE-193: the arrow in a positioned popup with a border points to the center of the trigger', async () => {
    const { trigger } = await mountMenu({
      arrow,
      trigger: { style: 'position: fixed; left: 300px; top: 200px; width: 40px' },
      popup: { style: 'position: relative; width: 120px; border: 1px solid' },
    });
    await userEvent.click(trigger);
    await placed();
    const element = byTestId('arrow')!;
    await waitFor(() => expect(element.style.left).toMatch(/px$/));
    expect(Math.abs(centerX(element) - centerX(trigger))).toBeLessThanOrEqual(0.5);
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
    // At the end of the animation the popup has no size of its own.
    expect(element.style.getPropertyValue('--popup-height')).toBe('');
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

  test('an arrow key that the submenu passes to a horizontal parent goes on from the trigger of the submenu', async () => {
    const { trigger } = await mountMenu({
      root: { orientation: 'horizontal' },
      submenu: { trigger: { delay: 0 } },
      sibling: {},
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(active()).toBe(item('sub'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowRight}');
    await closed(subPopup);
    expect(active()).toBe(item('sibling'));
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
    // A move from the trigger up and away from the submenu, outside the triangle. The moves are
    // events of the page, 10 ms apart: the move back must come in the close delay of 400 ms, and a
    // command can take more time.
    const away = () => {
      const box = item('sub').getBoundingClientRect();
      return movePointerThrough(centerOf(item('sub')), [
        { x: box.left + 10, y: box.top - 2 },
        centerOf(item('a')),
      ]);
    };
    await away();
    await movePointerThrough(centerOf(item('a')), [centerOf(item('sub'))]);
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
    // The parent stays until the submenu left, and then leaves. Each leave of 400 ms can end before
    // the command ends, so the case reads the page when each popup starts to leave or goes.
    const leaving = (element: Element) => element.classList.contains('menu-fade-leave-active');
    const atSubmenuLeave = readWhen(
      () => leaving(sub) || !sub.isConnected,
      () => ({
        submenu: leaving(sub),
        parent: { connected: parent.isConnected, hidden: parent.hidden, leaving: leaving(parent) },
      }),
    );
    const atParentLeave = readWhen(
      () => leaving(parent) || !parent.isConnected,
      () => ({ parent: leaving(parent), submenuConnected: sub.isConnected }),
    );
    await userEvent.pointer([{ coords: { x: 2, y: 600 } }, '[MouseLeft]']);
    expect(await atSubmenuLeave).toEqual({
      submenu: true,
      parent: { connected: true, hidden: false, leaving: false },
    });
    expect(await atParentLeave).toEqual({ parent: true, submenuConnected: false });
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

describe('the state of the items', () => {
  test('Enter and Space toggle a checkbox item and check a radio item; a second click unchecks the checkbox item', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      items: [],
      checkbox: { onCheckedChange: (checked: boolean) => log.push(`checkbox ${checked}`) },
      radio: { group: { onValueChange: (value: string) => log.push(`radio ${value}`) } },
    });
    await openWithKeyboard(trigger, 'checkbox');
    await userEvent.keyboard(' ');
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Enter}');
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{ArrowDown} ');
    expect(item('r1')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
    expect(item('r1')).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(item('checkbox'));
    await userEvent.click(item('checkbox'));
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
    expect(popup()).not.toBe(null);
    expect(log).toEqual([
      'checkbox true',
      'checkbox false',
      'radio r1',
      'radio r2',
      'checkbox true',
      'checkbox false',
    ]);
  });

  test('a checkbox item and a radio group with `v-model` show the value of the parent', async () => {
    const checkbox = reactive<Props>({ modelValue: true });
    const group = reactive<Props>({ modelValue: 'r2' });
    const { trigger } = await mountMenu({ checkbox, radio: { group } });
    await userEvent.click(trigger);
    await placed();
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(item('checkbox'));
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    checkbox.modelValue = false;
    await nextTick();
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(item('r3'));
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
    group.modelValue = 'r3';
    await nextTick();
    expect(item('r3')).toHaveAttribute('aria-checked', 'true');
  });

  test('Space in a typed string toggles no checkbox item, checks no radio item and opens no submenu; Space on a submenu trigger opens it', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({
      items: [{ key: 'a', text: 'Alpha' }],
      checkbox: { onCheckedChange: () => log.push('checkbox') },
      radio: { group: { onValueChange: () => log.push('radio') } },
      submenu: { trigger: { openOnHover: false } },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('checkbox  ');
    expect(active()).toBe(item('checkbox'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('r2 ');
    expect(active()).toBe(item('r2'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('more ');
    expect(active()).toBe(item('sub'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(subPopup()).toBe(null);
    expect(log).toEqual([]);
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard(' ');
    await opened(subPopup);
  });

  test('after an Escape in a typed string, Space toggles a checkbox item of the reopened menu', async () => {
    const { trigger } = await mountMenu({ items: [], checkbox: {} });
    await openWithKeyboard(trigger, 'checkbox');
    await userEvent.keyboard('c{Escape}');
    await closed();
    expect(active()).toBe(trigger);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('checkbox')));
    await userEvent.keyboard(' ');
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  test('a disabled checkbox item, a disabled radio item and the items of a disabled radio group take the focus, and Enter, Space and a click change nothing', async () => {
    const log: string[] = [];
    const record = (name: string) => () => log.push(name);
    for (const radio of [
      { group: { disabled: true, onValueChange: record('group') } },
      { group: { onValueChange: record('item') }, items: { disabled: true } },
    ]) {
      const { trigger, unmount } = await mountMenu({
        items: [],
        checkbox: {
          disabled: true,
          onCheckedChange: record('checkbox'),
          onClick: record('click'),
        },
        radio,
      });
      // A key open highlights no disabled item, and an arrow key reaches one.
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await opened();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(active()).toBe(item('checkbox')));
      expect(item('checkbox')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.keyboard('{Enter} ');
      await userEvent.click(item('checkbox'), { force: true });
      await userEvent.keyboard('{ArrowDown}');
      expect(active()).toBe(item('r1'));
      expect(item('r1')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.keyboard('{Enter} ');
      await userEvent.click(item('r2'), { force: true });
      expect(item('checkbox')).toHaveAttribute('aria-checked', 'false');
      expect(item('r2')).toHaveAttribute('aria-checked', 'false');
      expect(popup()).not.toBe(null);
      unmount();
    }
    expect(log).toEqual([]);
  });

  test('with `keepMounted`, a checked checkbox item and a checked radio item stay checked after a close and a reopen, and a closed item has no tab stop', async () => {
    const { trigger } = await mountMenu({
      portal: { keepMounted: true },
      root: { modal: false },
      checkbox: {},
      radio: {},
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('checkbox'));
    await userEvent.click(item('r2'));
    await userEvent.click(item('a'));
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    expect(active()).toBe(trigger);
    await userEvent.click(trigger);
    await waitFor(() => expect(popup()).not.toHaveAttribute('hidden'));
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(item('r2')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('a')));
    expect(item('a')).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    expect(active()?.id).toBe('after');
    expect(item('a')).toHaveAttribute('tabindex', '-1');
  });

  test('a group label has `aria-hidden` unless the developer gives another value; a label that mounts names the group, also when an older label leaves after it', async () => {
    for (const radio of [false, true]) {
      const state = reactive<{ labels: string[]; label?: Props }>({ labels: ['old'] });
      const { unmount } = mount(MenuGroupLabels, { state, radio });
      await waitFor(() => expect(byTestId('group')).toHaveAttribute('aria-labelledby', 'old'));
      expect(document.getElementById('old')).toHaveAttribute('aria-hidden', 'true');
      state.labels = ['old', 'new'];
      await nextTick();
      expect(byTestId('group')).toHaveAttribute('aria-labelledby', 'new');
      state.labels = ['new'];
      await nextTick();
      expect(byTestId('group')).toHaveAttribute('aria-labelledby', 'new');
      state.label = { 'aria-hidden': undefined };
      await nextTick();
      expect(document.getElementById('new')).not.toHaveAttribute('aria-hidden');
      unmount();
    }
  });
});

describe('the focus of an item press', () => {
  test('a press and Enter on an item whose listener moves the focus keep that focus after the close', async () => {
    for (const press of ['mouse', 'Enter']) {
      const { trigger, unmount } = await mountMenu({
        items: [{ key: 'a', attrs: { onClick: () => document.getElementById('after')!.focus() } }],
      });
      await userEvent.click(trigger);
      await placed();
      if (press === 'Enter') {
        item('a').focus();
        await userEvent.keyboard('{Enter}');
      } else {
        await userEvent.click(item('a'));
      }
      await closed();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(active()?.id, press).toBe('after');
      unmount();
    }
  });

  test('a press on an item gives it the focus before its `mouseup` and its `click`; a press that closes the menu gives the focus to the trigger', async () => {
    const focused: string[] = [];
    const read = (name: string) => () =>
      focused.push(`${name} ${active()?.getAttribute('data-key')}`);
    const { trigger } = await mountMenu({
      root: { highlightItemOnHover: false },
      items: [
        {
          key: 'a',
          attrs: { closeOnClick: false, onMouseup: read('mouseup'), onClick: read('click') },
        },
        { key: 'b' },
      ],
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('a'));
    expect(focused).toEqual(['mouseup a', 'click a']);
    await userEvent.click(item('b'));
    await closed();
    expect(active()).toBe(trigger);
  });

  test('`finalFocus` gets the type of the input that closed the menu', async () => {
    const types: string[] = [];
    const { trigger } = await mountMenu({
      popup: {
        finalFocus: (type: string) => {
          types.push(type);
          return true;
        },
      },
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.click(item('a'));
    await closed();
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Enter}');
    await closed();
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.pointer([{ coords: centerOf(item('b')) }, '[/MouseLeft]']);
    await closed();
    expect(types).toEqual(['mouse', 'keyboard', 'mouse']);
    expect(active()).toBe(trigger);
  });
});

describe('the keys and the typed string of more items', () => {
  test('an item that is a natively disabled button, and an item that CSS hides, are out of the arrow keys and the typed string', async () => {
    const { trigger } = await mountMenu({
      items: [
        { key: 'a', text: 'Apple' },
        { key: 'b', text: 'Banana', nativeDisabled: true },
        { key: 'c', text: 'Blueberry', attrs: { style: 'display: none' } },
        { key: 'd', text: 'Berry' },
      ],
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('d'));
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('a'));
    await userEvent.keyboard('b');
    expect(active()).toBe(item('d'));
    expect(item('b')).not.toHaveAttribute('data-highlighted');
    expect(item('b')).toHaveAttribute('tabindex', '-1');
    expect(item('c')).toHaveAttribute('tabindex', '-1');
  });

  test('the typed string reads `label`, skips an item with no text, matches letters with diacritics, and goes across groups', async () => {
    const { trigger } = await mountMenu({
      group: {},
      items: [
        { key: 'a', text: 'Aa' },
        { key: 'b', text: 'Ba', attrs: { label: 'Zeta' } },
        { key: 'empty', text: ' ' },
        { key: 'c', text: 'Bą' },
        { key: 'd', text: 'Bc' },
      ],
      submenu: { trigger: { label: 'Reports', openOnHover: false } },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('z');
    expect(active()).toBe(item('b'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('bą');
    expect(active()).toBe(item('c'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('bc');
    expect(active()).toBe(item('d'));
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.keyboard('r');
    expect(active()).toBe(item('sub'));
  });

  test('an arrow key on an element of the popup that is no item goes to the first or the last item', async () => {
    const { trigger } = await mountMenu({ custom: true });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('b'));
    byTestId('custom')!.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
    byTestId('profile')!.focus();
    expect(item('a')).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('b'));
    byTestId('profile')!.focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(active()).toBe(item('c')));
    byTestId('custom')!.focus();
    expect(item('c')).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(active()).toBe(item('c')));
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('b'));
  });

  test('`aria-labelledby` of the developer names the popup in place of the trigger', async () => {
    const { trigger } = await mountMenu({ popup: { 'aria-labelledby': 'before' } });
    await userEvent.click(trigger);
    expect(await opened()).toHaveAttribute('aria-labelledby', 'before');
  });

  test('a backdrop lets the pointer through when a hover opened the menu, and not when a press opened it', async () => {
    const { trigger } = await mountMenu({
      backdrop: {},
      trigger: { openOnHover: true, delay: 0 },
    });
    await userEvent.hover(trigger);
    await opened();
    expect(byTestId('backdrop')!.style.pointerEvents).toBe('none');
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    await closed();
    await userEvent.click(trigger);
    await opened();
    await placed();
    expect(byTestId('backdrop')!.style.pointerEvents).toBe('');
  });
});

describe('a menu and a dialog', () => {
  test('a dialog that an item opens keeps the focus when the pointer leaves the item; Shift+Tab in it keeps the menu and the dialog open', async () => {
    for (const alert of [false, true]) {
      const { unmount } = mount(MenuWithDialog, { alert });
      await nextTick();
      await userEvent.click(byTestId('trigger')!);
      await opened();
      await waitFor(() => expect(item('open')).not.toBe(null));
      await userEvent.click(item('open'));
      const dialog = await opened(() => byTestId('dialog-popup'));
      await waitFor(() => expect(dialog.contains(active())).toBe(true));
      await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(dialog.contains(active()), String(alert)).toBe(true);
      byTestId('dialog-button')!.focus();
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).not.toBe(null);
      expect(byTestId('dialog-popup')).not.toBe(null);
      expect(dialog.contains(active())).toBe(true);
      unmount();
    }
  });

  test('an item that hides the trigger of its menu in a dialog leaves the focus in the dialog', async () => {
    mount(MenuTriggerHides, { dialog: true });
    await opened(() => byTestId('dialog-popup'));
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await userEvent.click(item('blank'));
    await closed();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('dialog-popup')).not.toBe(null);
    expect(active()).not.toBe(byTestId('dialog-trigger'));
  });

  test('an input that takes the focus when the trigger hides at the close keeps the focus', async () => {
    mount(MenuTriggerHides);
    await nextTick();
    await userEvent.click(byTestId('other')!);
    await opened(() => byTestId('other-popup'));
    await userEvent.keyboard('{Escape}');
    await closed(() => byTestId('other-popup'));
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await userEvent.click(item('rename'));
    await closed();
    const input = () => document.querySelector('input[aria-label="Name"]');
    await waitFor(() => expect(active()).toBe(input()));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(input());
  });
});

describe('more of the submenus', () => {
  test('a submenu opens with ArrowLeft in a right-to-left menu; a horizontal submenu opens with ArrowDown and closes with ArrowUp', async () => {
    const rtl = await mountMenu({
      positioner: { dir: 'rtl' },
      submenu: { trigger: { delay: 0 }, positioner: { dir: 'rtl' } },
    });
    await openWithKeyboard(rtl.trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    expect(subPopup()).toBe(null);
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowLeft}');
    expect(subPopup()).not.toBe(null);
    await userEvent.keyboard('{ArrowRight}');
    await closed(subPopup);
    expect(active()).toBe(item('sub'));
    rtl.unmount();
    const horizontal = await mountMenu({
      root: { orientation: 'horizontal' },
      submenu: { trigger: { delay: 0 }, root: { orientation: 'horizontal' } },
    });
    horizontal.trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(active()).toBe(item('a')));
    await userEvent.keyboard('{End}{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{ArrowUp}');
    await closed(subPopup);
    expect(active()).toBe(item('sub'));
  });

  test('a new `id` of a trigger or a submenu trigger names its open popup and keeps it expanded; a new `id` of a popup is the `aria-controls` of its trigger; the submenu trigger keeps the tab stop of its menu while the submenu is open', async () => {
    const subTrigger = reactive<Props>({ delay: 0, id: 'first' });
    const mainTrigger = reactive<Props>({ id: 'main' });
    const mainPopup = reactive<Props>({ id: 'menu' });
    const subMenuPopup = reactive<Props>({ id: 'submenu' });
    const { trigger } = await mountMenu({
      trigger: mainTrigger,
      popup: mainPopup,
      submenu: { trigger: subTrigger, popup: subMenuPopup },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    const element = await opened(subPopup);
    await waitFor(() => expect(active()).toBe(item('s1')));
    expect(item('sub')).toHaveAttribute('tabindex', '0');
    expect(element).toHaveAttribute('aria-labelledby', 'first');
    subTrigger.id = 'second';
    await nextTick();
    expect(item('sub').id).toBe('second');
    expect(element).toHaveAttribute('aria-labelledby', 'second');
    expect(item('sub')).toHaveAttribute('data-popup-open');
    expect(item('sub')).toHaveAttribute('aria-controls', 'submenu');
    subMenuPopup.id = 'submenu-2';
    await nextTick();
    expect(item('sub')).toHaveAttribute('aria-controls', 'submenu-2');
    mainTrigger.id = 'renamed';
    await nextTick();
    expect(popup()).toHaveAttribute('aria-labelledby', 'renamed');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', 'menu');
    mainPopup.id = 'menu-2';
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', 'menu-2');
    await userEvent.keyboard('{Escape}{Escape}');
    await closed();
    expect(active()).toBe(trigger);
  });

  test('a disabled submenu trigger has `aria-disabled`, and a hover, a press or a key opens nothing', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { delay: 0, disabled: true } } });
    await userEvent.click(trigger);
    await placed();
    expect(item('sub')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(item('sub'));
    await userEvent.click(item('sub'), { force: true });
    item('sub').focus();
    await userEvent.keyboard('{ArrowRight}{Enter} ');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(subPopup()).toBe(null);
  });

  test('a press of a screen reader toggles a submenu at once, also one with `openOnHover` false; the details name the trigger, also for a press on an element in it', async () => {
    const press = (element: Element) => {
      const init = { bubbles: true, cancelable: true, detail: 0 };
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          ...init,
          pointerType: 'mouse',
          width: 1,
          height: 1,
          pressure: 0,
          buttons: 0,
        }),
      );
      element.dispatchEvent(new MouseEvent('mousedown', init));
      element.dispatchEvent(
        new PointerEvent('pointerup', {
          ...init,
          pointerType: 'mouse',
          width: 1,
          height: 1,
          pressure: 0,
        }),
      );
      element.dispatchEvent(new MouseEvent('mouseup', init));
      element.dispatchEvent(new MouseEvent('click', init));
    };
    for (const openOnHover of [true, false]) {
      const log: string[] = [];
      const { trigger, unmount } = await mountMenu({
        submenu: {
          trigger: { openOnHover },
          root: {
            onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
              log.push(`${open} ${details.reason} ${details.trigger === item('sub')}`),
          },
        },
      });
      await userEvent.click(trigger);
      await placed();
      const icon = item('sub').appendChild(document.createElement('span'));
      press(icon);
      await nextTick();
      expect(subPopup(), String(openOnHover)).not.toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(subPopup()).not.toBe(null);
      press(item('sub'));
      await closed(subPopup);
      expect(popup()).not.toBe(null);
      expect(log).toEqual(['true trigger-press true', 'false trigger-press true']);
      unmount();
    }
  });

  test('Enter and Space on a submenu trigger that a hover opened keep the submenu open', async () => {
    for (const key of ['{Enter}', ' ']) {
      const { trigger, unmount } = await mountMenu({ submenu: { trigger: { delay: 0 } } });
      await userEvent.click(trigger);
      await placed();
      await userEvent.hover(item('sub'));
      await opened(subPopup);
      await waitFor(() => expect(active()).toBe(item('sub')));
      expect(item('sub')).toHaveAttribute('aria-expanded', 'true');
      await userEvent.keyboard(key);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(subPopup(), key).not.toBe(null);
      expect(popup()).not.toBe(null);
      unmount();
    }
  });

  test.skipIf(server.browser !== 'chromium')(
    'a second tap on a submenu trigger closes the submenu',
    async () => {
      const { trigger } = await mountMenu({ submenu: { trigger: { delay: 0 } } });
      await userEvent.click(trigger);
      await placed();
      await touchDrag(centerOf(item('sub')), centerOf(item('sub')), 0);
      await opened(subPopup);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await touchDrag(centerOf(item('sub')), centerOf(item('sub')), 0);
      await closed(subPopup);
      expect(popup()).not.toBe(null);
    },
  );
});

describe('more of the trigger', () => {
  test.each([true, false])(
    'Shift+Tab on the trigger of an open menu closes it and gives the focus to the element before it: modal %s',
    async (modal) => {
      const { trigger } = await mountMenu({ root: { modal } });
      await userEvent.click(trigger);
      await waitFor(() => expect(active()).toBe(popup()));
      trigger.focus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      await closed();
      expect(active()?.id).toBe('before');
    },
  );

  test.each([
    { name: 'with no size', init: { width: 0, height: 0 } },
    { name: 'of 1 by 1 pixel with no pressure', init: { width: 1, height: 1, pressure: 0 } },
    {
      name: 'of a touch of VoiceOver on iOS',
      init: { pointerType: 'touch', width: 0.333, height: 0.333, pressure: 0 },
    },
  ])(
    'the press of a screen reader on the trigger, $name, opens the menu with the focus on its first item',
    async ({ init }) => {
      const { trigger } = await mountMenu();
      const pointer = {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        buttons: 0,
        ...init,
      };
      const mouse = { bubbles: true, cancelable: true, detail: 1 };
      trigger.dispatchEvent(new PointerEvent('pointerdown', pointer));
      trigger.dispatchEvent(new MouseEvent('mousedown', mouse));
      trigger.dispatchEvent(new PointerEvent('pointerup', pointer));
      trigger.dispatchEvent(new MouseEvent('mouseup', mouse));
      trigger.dispatchEvent(new MouseEvent('click', mouse));
      await opened();
      await waitFor(() => expect(active()).toBe(item('a')));
    },
  );

  test('`disabled` on a trigger disables it, and its menu opens nothing', async () => {
    const log: string[] = [];
    const { trigger } = await mountMenu({ root: rootEvents(log), trigger: { disabled: true } });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger, { force: true });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(log).toEqual([]);
  });

  test('a handle says that a menu whose close a listener canceled is open, and its trigger stays expanded', async () => {
    const handle = Menu.createHandle();
    const root = reactive<Props>({
      handle,
      modal: false,
      onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) => {
        if (!open && details.reason === 'outside-press') details.cancel();
      },
    });
    const { trigger } = await mountMenu({ root, trigger: { id: 'mine', handle } });
    await userEvent.click(trigger);
    await placed();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(document.getElementById('outside')!);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(handle.isOpen).toBe(true);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(handle.isOpen).toBe(false);
  });

  test('a press in the first 500 ms after a hover open keeps the menu open and makes it modal; a later press closes it', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 0 } });
    await userEvent.hover(trigger);
    await opened();
    expect(document.querySelector(BLOCK)).toBe(null);
    await userEvent.click(trigger);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
    // The menu stays after the pointer leaves.
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).not.toBe(null);
    // An item press closes it, and a new hover opens it again.
    await userEvent.click(item('a'));
    await closed();
    await userEvent.hover(trigger);
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.click(trigger);
    await closed();
  });

  test('with `openOnHover`, the menu closes `closeDelay` after the pointer leaves; a menu that the parent opened stays', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { modal: false });
    const { trigger } = await mountMenu({
      root,
      trigger: { openOnHover: true, delay: 0, closeDelay: 200 },
    });
    await userEvent.hover(trigger);
    await opened();
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).not.toBe(null);
    await closed();
    expect(log).toEqual([
      'openChange true trigger-hover',
      'update true',
      'openChange false trigger-hover',
      'update false',
    ]);
    root.open = true;
    await opened();
    await placed();
    await userEvent.hover(item('a'));
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(popup()).not.toBe(null);
  });

  test('the template ref stops a hover open that waits for its delay', async () => {
    const log: string[] = [];
    const { trigger, exposed } = await mountMenu({
      root: rootEvents(log),
      trigger: { openOnHover: true, delay: 300 },
    });
    await userEvent.hover(trigger);
    exposed.root.close();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(log).toEqual([]);
    expect(popup()).toBe(null);
  });

  test('with `openOnHover`, the pointer crosses the gap from the trigger to the popup with no close', async () => {
    const { trigger } = await mountMenu({
      root: { modal: false },
      trigger: { openOnHover: true, delay: 0 },
      positioner: { sideOffset: 24 },
    });
    await userEvent.hover(trigger);
    await opened();
    await placed();
    const from = centerOf(trigger);
    const to = centerOf(item('a'));
    expect(
      item('a').getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
    ).toBeGreaterThanOrEqual(20);
    await movePointerThrough(from, [
      { x: from.x, y: (from.y + to.y) / 2 },
      { x: to.x, y: to.y },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).not.toBe(null);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('more of the root', () => {
  test('a portal with `to` renders the popup in that element, and the open popup takes the focus; a new target moves the popup, also a closed one with `keepMounted`', async () => {
    const first = document.body.appendChild(document.createElement('div'));
    const second = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => {
      first.remove();
      second.remove();
    });
    const portal = reactive<Props>({ to: first, keepMounted: true });
    await mountMenu({ portal, root: { defaultOpen: true } });
    const element = await opened();
    expect(first.contains(element)).toBe(true);
    await waitFor(() => expect(active()).toBe(element));
    portal.to = second;
    await nextTick();
    expect(second.contains(popup())).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    expect(second.contains(popup())).toBe(true);
  });

  test('a handle with two triggers: the keys, a submenu and the return of the focus work for each trigger; the details of a close name the active trigger; an open of the open menu and a close of a closed one emit nothing', async () => {
    const handle = Menu.createHandle();
    const log: string[] = [];
    await mountMenu({
      root: {
        handle,
        onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
          log.push(`${open} ${details.reason} ${(details.trigger as Element | undefined)?.id}`),
      },
      trigger: { id: 'first', handle },
      detached: { id: 'second', handle },
      submenu: { trigger: { openOnHover: false } },
    });
    for (const id of ['first', 'second']) {
      const element = document.getElementById(id)!;
      element.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(active()).toBe(item('a')));
      expect(element).toHaveAttribute('aria-expanded', 'true');
      expect(popup()).toHaveAttribute('aria-labelledby', id);
      await userEvent.keyboard('{End}{ArrowRight}');
      await waitFor(() => expect(active()).toBe(item('s1')));
      await userEvent.keyboard('{ArrowLeft}');
      await closed(subPopup);
      await userEvent.click(item('sub'));
      await opened(subPopup);
      await userEvent.keyboard('{Escape}');
      await closed(subPopup);
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(active()).toBe(element);
    }
    log.length = 0;
    await userEvent.click(document.getElementById('second')!);
    await opened();
    handle.open('second');
    handle.close();
    await closed();
    handle.close();
    expect(log).toEqual(['true trigger-press second', 'false imperative-action second']);
  });

  test('items that render after a key open: the first one gets the focus', async () => {
    const items = reactive<{ key: string }[]>([]);
    const { trigger } = await mountMenu({
      items,
      root: {
        onOpenChange: (open: boolean) => {
          if (open) queueMicrotask(() => items.push({ key: 'a' }, { key: 'b' }));
        },
      },
    });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(active()).toBe(item('a')));
  });

  test('a disabled root that is open: its items have `aria-disabled`, and a press, a key or a typed letter does nothing', async () => {
    const log: string[] = [];
    await mountMenu({
      root: rootEvents(log, { defaultOpen: true, disabled: true }),
      items: [
        { key: 'a', text: 'Alpha', attrs: { onClick: () => log.push('click') } },
        { key: 'b', text: 'Beta' },
      ],
      checkbox: {},
      radio: {},
      submenu: { trigger: { openOnHover: false } },
    });
    await opened();
    await placed();
    for (const key of ['a', 'checkbox', 'r1', 'sub']) {
      expect(item(key), key).toHaveAttribute('aria-disabled', 'true');
    }
    await userEvent.click(item('a'), { force: true });
    await userEvent.click(item('sub'), { force: true });
    item('a').focus();
    await userEvent.keyboard('b');
    expect(item('b')).not.toHaveAttribute('data-highlighted');
    expect(subPopup()).toBe(null);
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('Escape with the focus on the body closes the open submenu only, also when the root cancels its own close', async () => {
    const sub: string[] = [];
    await mountMenu({
      root: {
        onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) => {
          if (!open && details.reason === 'escape-key') details.cancel();
        },
      },
      submenu: {
        trigger: { delay: 0 },
        root: {
          onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
            sub.push(`${open} ${details.reason}`),
        },
      },
    });
    await userEvent.click(byTestId('trigger')!);
    await placed();
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(active()).toBe(document.body);
    await userEvent.keyboard('{Escape}');
    await closed(subPopup);
    expect(sub).toEqual(['true trigger-hover', 'false escape-key']);
    expect(popup()).not.toBe(null);
  });

  test('Escape with the focus on the body asks the submenu that opened with its root to close', async () => {
    const sub: string[] = [];
    const root = reactive<Props>({ open: false });
    const submenuRoot = reactive<Props>({
      open: false,
      onOpenChange: (open: boolean, details: MenuRootChangeEventDetails) =>
        sub.push(`${open} ${details.reason}`),
    });
    await mountMenu({ root, submenu: { trigger: { delay: 0 }, root: submenuRoot } });
    root.open = true;
    submenuRoot.open = true;
    await opened(subPopup);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('{Escape}');
    expect(sub).toEqual(['false escape-key']);
  });
});

describe('more of the keys', () => {
  test('Enter on an item closes the menu with a click of `detail` 0; ArrowLeft goes back through each level of submenus to each trigger', async () => {
    const details: number[] = [];
    const { trigger } = await mountMenu({
      root: {
        onOpenChange: (open: boolean, change: MenuRootChangeEventDetails) => {
          if (!open) details.push((change.event as MouseEvent).detail);
        },
      },
      submenu: { trigger: { delay: 0 }, nested: { trigger: { delay: 0 } } },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('d1')));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(() => byTestId('deep-popup'));
    expect(active()).toBe(item('deep'));
    await userEvent.keyboard('{ArrowLeft}');
    await closed(subPopup);
    expect(active()).toBe(item('sub'));
    await userEvent.keyboard('{Home}{Enter}');
    await closed();
    expect(details).toEqual([0]);
  });

  test('with `highlightItemOnHover` false, a hover on a submenu trigger highlights nothing and gives it no focus', async () => {
    const { trigger } = await mountMenu({
      root: { highlightItemOnHover: false },
      submenu: { trigger: { delay: 0, openOnHover: false } },
    });
    await userEvent.click(trigger);
    await placed();
    await userEvent.hover(item('sub'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(item('sub')).not.toHaveAttribute('data-highlighted');
    expect(active()).not.toBe(item('sub'));
  });

  test('Enter on a submenu trigger opens the submenu; on an Apple platform the trigger then has no `aria-expanded`', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { openOnHover: false } } });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{Enter}');
    await waitFor(() => expect(active()).toBe(item('s1')));
    if (platform.os.apple) expect(item('sub')).not.toHaveAttribute('aria-expanded');
    else expect(item('sub')).toHaveAttribute('aria-expanded', 'true');
  });

  test('with `openOnHover`, a press before the end of the hover delay opens the menu, and it stays after the pointer leaves', async () => {
    const { trigger } = await mountMenu({ trigger: { openOnHover: true, delay: 300 } });
    await userEvent.hover(trigger);
    await userEvent.click(trigger);
    await opened();
    await userEvent.pointer({ coords: { x: 2, y: window.innerHeight - 2 } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(popup()).not.toBe(null);
  });
});

describe('more of the list', () => {
  test('a `List`: the trigger follows a new `id` of the list in `aria-controls`, and an inactive trigger of a handle has none; ArrowUp after a press goes to the last item, also with `loopFocus` false', async () => {
    const handle = Menu.createHandle();
    const list = reactive<Props>({ id: 'old' });
    const { trigger } = await mountMenu({
      list,
      root: { handle, loopFocus: false },
      trigger: { id: 'first', handle },
      detached: { id: 'second', handle },
    });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(byTestId('list')));
    expect(trigger).toHaveAttribute('aria-controls', 'old');
    expect(document.getElementById('second')).not.toHaveAttribute('aria-controls');
    list.id = 'new';
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', 'new');
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('c'));
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toBe(item('b'));
  });
});

describe('more of the pointer', () => {
  test('a drag release on a checkbox item checks it and keeps the menu open, and an arrow key goes on from it; on a disabled item it gives the focus and no click', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountMenu({
      root: { highlightItemOnHover: false },
      items: [
        { key: 'a' },
        { key: 'b', attrs: { disabled: true, onClick: () => clicks.push('b') } },
      ],
      checkbox: {},
      radio: {},
    });
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.pointer([{ coords: centerOf(item('checkbox')) }, '[/MouseLeft]']);
    expect(item('checkbox')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(active()).toBe(item('checkbox')));
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('r1'));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await userEvent.pointer([{ coords: centerOf(item('b')) }, '[/MouseLeft]']);
    await waitFor(() => expect(active()).toBe(item('b')));
    expect(clicks).toEqual([]);
    expect(popup()).not.toBe(null);
  });

  test('a drag release on an item of a submenu clicks it and closes each menu', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountMenu({
      submenu: {
        trigger: { delay: 0 },
        items: [{ key: 's1', attrs: { onClick: () => clicks.push('s1') } }, { key: 's2' }],
      },
    });
    await userEvent.pointer([{ coords: centerOf(trigger) }, '[MouseLeft>]']);
    await placed();
    await userEvent.pointer({ coords: centerOf(item('sub')) });
    await opened(subPopup);
    await waitFor(() => expect(byTestId('sub-positioner')?.style.visibility).toBe(''));
    await new Promise((resolve) => setTimeout(resolve, 220));
    await movePointerThrough(centerOf(item('sub')), [centerOf(item('s1'))], 1);
    await userEvent.pointer([{ coords: centerOf(item('s1')) }, '[/MouseLeft]']);
    await closed();
    expect(clicks).toEqual(['s1']);
  });

  test('a submenu trigger opens after its delay while the pointer moves on it; a pointer that leaves to another item before the delay opens nothing', async () => {
    const { trigger } = await mountMenu({ submenu: { trigger: { delay: 150 } } });
    await userEvent.click(trigger);
    await placed();
    const box = item('sub').getBoundingClientRect();
    const at = (x: number) => ({ x: box.left + x, y: box.top + box.height / 2 });
    await userEvent.pointer({ coords: at(5) });
    for (const x of [10, 15, 20, 25]) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      await userEvent.pointer({ coords: at(x) });
    }
    await opened(subPopup);
    const toA = () =>
      movePointerThrough(at(25), [
        { x: at(25).x, y: box.top - 2 },
        centerOf(item('a')),
        { x: centerOf(item('a')).x + 2, y: centerOf(item('a')).y },
      ]);
    await toA();
    await closed(subPopup);
    await userEvent.pointer({ coords: at(25) });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await toA();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(subPopup()).toBe(null);
  });

  test('a menu that opens on hover keeps open while the pointer goes into its submenu; a hover on a sibling of a third level closes only that level', async () => {
    const { trigger } = await mountMenu({
      root: { modal: false },
      trigger: { openOnHover: true, delay: 0 },
      submenu: { trigger: { delay: 0 }, nested: { trigger: { delay: 0 } } },
    });
    await userEvent.hover(trigger);
    await opened();
    await placed();
    await userEvent.hover(item('a'));
    await userEvent.hover(item('sub'));
    await opened(subPopup);
    await waitFor(() => expect(byTestId('sub-positioner')?.style.visibility).toBe(''));
    await movePointerThrough(centerOf(item('sub')), [centerOf(item('s1'))]);
    await userEvent.hover(item('deep'));
    await opened(() => byTestId('deep-popup'));
    const deep = item('deep').getBoundingClientRect();
    await movePointerThrough(centerOf(item('deep')), [
      { x: deep.left + 5, y: deep.top - 2 },
      centerOf(item('s1')),
      { x: centerOf(item('s1')).x + 2, y: centerOf(item('s1')).y },
    ]);
    await closed(() => byTestId('deep-popup'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(subPopup()).not.toBe(null);
    expect(popup()).not.toBe(null);
  });

  test('itemHighlighted gives the key of a typed letter, the event of a pointer that leaves, the event of a hover on a submenu trigger, and `none` for a change of the list', async () => {
    const events: [string | undefined, string, string | undefined][] = [];
    const items = reactive([
      { key: 'a', text: 'Alpha' },
      { key: 'b', text: 'Tango' },
    ]);
    const { trigger } = await mountMenu({
      root: {
        onItemHighlighted: (
          element: HTMLElement | undefined,
          details: { reason: string; event: Event | undefined },
        ) =>
          events.push([
            element?.getAttribute('data-key') ?? undefined,
            details.reason,
            (details.event as KeyboardEvent | undefined)?.key ?? details.event?.type,
          ]),
      },
      items,
      submenu: { trigger: { delay: 0 } },
    });
    await openWithKeyboard(trigger);
    await userEvent.keyboard('t');
    expect(events.at(-1)).toEqual(['b', 'keyboard', 't']);
    await userEvent.hover(item('sub'));
    await waitFor(() => expect(events.at(-1)?.[0]).toBe('sub'));
    expect(events.at(-1)).toEqual(['sub', 'pointer', 'pointermove']);
    await userEvent.keyboard('{Escape}');
    await closed(subPopup);
    await userEvent.hover(item('a'));
    await userEvent.pointer({ coords: { x: window.innerWidth - 2, y: 2 } });
    await waitFor(() => expect(events.at(-1)?.[0]).toBe(undefined));
    expect(events.at(-1)?.[1]).toBe('pointer');
    item('b').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(events.at(-1)?.[0]).toBe('a');
    items.splice(0, 1);
    await waitFor(() => expect(events.at(-1)).toEqual([undefined, 'none', undefined]));
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

  test('each other part outside its parent throws an error that names the part and its parent', () => {
    const cases: [Props, string][] = [
      [{ part: 'Item', place: 'alone' }, '<Menu.Item> must be inside <Menu.Root>'],
      [
        { part: 'Trigger', place: 'alone' },
        '<Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`',
      ],
      [{ part: 'SubmenuRoot', place: 'alone' }, '<Menu.SubmenuRoot> must be inside <Menu.Root>'],
      [{ part: 'Popup' }, '<Menu.Popup> must be inside <Menu.Positioner>'],
      [
        { part: 'GroupLabel' },
        '<Menu.GroupLabel> must be inside <Menu.Group> or <Menu.RadioGroup>',
      ],
      [{ part: 'RadioItem' }, '<Menu.RadioItem> must be inside <Menu.RadioGroup>'],
      [{ part: 'SubmenuTrigger' }, '<Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>'],
      [
        { part: 'Trigger', place: 'alone', context: true },
        '<ContextMenu.Trigger> must be inside <ContextMenu.Root>',
      ],
    ];
    for (const [props, message] of cases) {
      expect(String(mountError(MenuPartAlone, props)), message).toContain(message);
    }
    takeReportedMessages();
  });
});
