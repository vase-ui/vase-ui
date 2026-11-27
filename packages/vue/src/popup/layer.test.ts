import { expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, type Component } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogWithInnerPopup from '../../test/fixtures/DialogWithInnerPopup.vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PreviewCardParts from '../../test/fixtures/PreviewCardParts.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import TooltipParts from '../../test/fixtures/TooltipParts.vue';
import { firePointer, sendTouch, stopFling, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

interface Family {
  name: string;
  fixture: Component;
  props: Record<string, unknown>;
  /** The test id of the popup. */
  popup: string;
  /** The trigger that a tap opens. With none, the popup is open at the mount. */
  trigger?: string;
}

// A menu and a select that a touch opens do not lock the scroll, so the page can scroll.
const families: Family[] = [
  { name: 'Popover', fixture: PopoverParts, props: {}, popup: 'popup', trigger: '[data-key="t"]' },
  {
    name: 'Dialog with modal false',
    fixture: DialogParts,
    props: { root: { modal: false } },
    popup: 'popup',
    trigger: '[data-key="t"]',
  },
  {
    name: 'Menu',
    fixture: MenuParts,
    props: {},
    popup: 'popup',
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Select',
    fixture: SelectParts,
    props: {},
    popup: 'popup',
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Combobox',
    fixture: ComboboxParts,
    props: { root: { defaultOpen: true } },
    popup: 'popup',
  },
  {
    name: 'PreviewCard',
    fixture: PreviewCardParts,
    props: { root: { defaultOpen: true } },
    popup: 'popup',
  },
  {
    name: 'Tooltip',
    fixture: TooltipParts,
    props: { tooltips: [{ name: 't', root: { defaultOpen: true } }] },
    popup: 'popup-t',
  },
  {
    name: 'NavigationMenu',
    fixture: NavigationMenuParts,
    props: { root: { defaultValue: 'one' } },
    popup: 'popup',
  },
];

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

test.skipIf(server.browser !== 'chromium').each(families)(
  'VUE-172: $name: a real touch outside that scrolls the page or that the browser cancels closes nothing; a tap closes',
  async ({ fixture, props, popup, trigger }) => {
    // The page has room to scroll.
    const page = document.body.appendChild(document.createElement('div'));
    page.style.cssText = 'position: absolute; left: 0; top: 0; width: 1px; height: 3000px';
    onTestFinished(() => {
      page.remove();
      scrollTo(0, 0);
    });
    mount(fixture, props);
    const popupElement = () => document.querySelector(`[data-testid="${popup}"]`);
    // A select keeps its popup in the DOM after a close.
    const shown = () => !!popupElement()?.checkVisibility();
    if (trigger) {
      const point = centerOf(document.querySelector(trigger)!);
      await touchDrag(point, point, 0);
    }
    await waitFor(() => expect(shown()).toBe(true));
    const start = { x: 30, y: innerHeight - 60 };
    expect(popupElement()!.contains(document.elementFromPoint(start.x, start.y))).toBe(false);

    await touchDrag(start, { x: start.x, y: start.y - 150 }, 25);
    // A tap that stops a fling gives no `click` on Linux, Windows and ChromeOS.
    await stopFling();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrollY).toBeGreaterThan(0);
    expect(shown()).toBe(true);

    await sendTouch('touchStart', [start]);
    await sendTouch('touchCancel', []);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(shown()).toBe(true);

    await touchDrag(start, start, 0);
    await waitFor(() => expect(shown()).toBe(false));
  },
);

const open = { root: { defaultOpen: true } };
const popover: Family = { name: 'Popover', fixture: PopoverParts, props: open, popup: 'popup' };
const openFamilies: Family[] = [
  popover,
  { name: 'Dialog', fixture: DialogParts, props: open, popup: 'popup' },
  { name: 'Menu', fixture: MenuParts, props: open, popup: 'popup' },
  { name: 'Select', fixture: SelectParts, props: open, popup: 'popup' },
  { name: 'Combobox', fixture: ComboboxParts, props: open, popup: 'popup' },
  { name: 'Autocomplete', fixture: AutocompleteParts, props: open, popup: 'popup' },
  { name: 'PreviewCard', fixture: PreviewCardParts, props: open, popup: 'popup' },
  {
    name: 'Tooltip',
    fixture: TooltipParts,
    props: { tooltips: [{ name: 't', root: { defaultOpen: true } }] },
    popup: 'popup-t',
  },
  {
    name: 'NavigationMenu',
    fixture: NavigationMenuParts,
    props: { root: { defaultValue: 'one' } },
    popup: 'popup',
  },
];

/** Mounts the fixture with its popup open, and an element of the page that is outside it. */
async function mountOpen({ fixture, props, popup }: Family) {
  // An element that a script adds after the open is no press outside, so it comes first.
  const outside = document.body.appendChild(document.createElement('div'));
  outside.style.cssText = 'position: fixed; left: 0; bottom: 0; width: 120px; height: 60px';
  onTestFinished(() => outside.remove());
  mount(fixture, props);
  const popupElement = () => document.querySelector(`[data-testid="${popup}"]`);
  // A select keeps its popup in the DOM after a close.
  const shown = () => !!popupElement()?.checkVisibility();
  await waitFor(() => expect(shown()).toBe(true));
  return { outside, shown };
}

test.each(openFamilies)(
  'VUE-172: $name: a dispatched touch outside that moves more than 8 px closes nothing; a tap that moves 8 px closes at its `pointerup` and leaves its `touchend` to the page',
  async (family) => {
    const { outside, shown } = await mountOpen(family);
    const { x, y } = centerOf(outside);
    const touch = { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
    // 8.5 px, with 6 px on each axis.
    const far = { ...touch, clientX: x + 6, clientY: y + 6 };
    await firePointer.down(outside, { ...touch, timeStamp: 1000 });
    await firePointer.move(outside, { ...far, timeStamp: 1050 });
    await firePointer.up(outside, { ...far, timeStamp: 1100 });
    await nextTick();
    expect(shown()).toBe(true);
    const near = { ...touch, clientX: x + 8 };
    await firePointer.down(outside, { ...touch, timeStamp: 2000 });
    await firePointer.move(outside, { ...near, timeStamp: 2050 });
    await firePointer.up(outside, { ...near, timeStamp: 2100 });
    const end = new Event('touchend', { bubbles: true, cancelable: true });
    outside.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(false);
    await waitFor(() => expect(shown()).toBe(false));
  },
);

const uncovered: Family[] = [
  popover,
  {
    name: 'Dialog with modal false',
    fixture: DialogParts,
    props: { root: { defaultOpen: true, modal: false } },
    popup: 'popup',
  },
  { name: 'Combobox', fixture: ComboboxParts, props: open, popup: 'popup' },
  { name: 'Autocomplete', fixture: AutocompleteParts, props: open, popup: 'popup' },
  { name: 'PreviewCard', fixture: PreviewCardParts, props: open, popup: 'popup' },
];

test.skipIf(server.browser !== 'chromium').each(uncovered)(
  '$name: a real tap on an element of the page outside closes the popup, and the element gets the `click` of the tap',
  async (family) => {
    const { outside, shown } = await mountOpen(family);
    const events: string[] = [];
    outside.addEventListener('mousedown', () => events.push('mousedown'));
    outside.addEventListener('click', () => events.push('click'));
    const point = centerOf(outside);
    expect(document.elementFromPoint(point.x, point.y)).toBe(outside);
    await touchDrag(point, point, 0);
    await waitFor(() => expect(events).toEqual(['mousedown', 'click']));
    await waitFor(() => expect(shown()).toBe(false));
  },
);

// A press of a mouse or a pen that the browser takes, such as for a scroll, ends with
// `pointercancel` and no `click`. A later tap gives its own `click`.
test('a tap in a popup after a press outside that the browser canceled keeps the popup open', async () => {
  const { outside, shown } = await mountOpen(popover);
  const popup = document.querySelector('[data-testid="popup"]')!;
  const from = centerOf(outside);
  const pen = { pointerType: 'pen', isPrimary: true, button: 0, clientX: from.x, clientY: from.y };
  await firePointer.down(outside, { ...pen, timeStamp: 1000 });
  await firePointer.cancel(outside, { ...pen, timeStamp: 1100 });
  const to = centerOf(popup);
  const touch = { pointerType: 'touch', isPrimary: true, clientX: to.x, clientY: to.y };
  await firePointer.down(popup, { ...touch, timeStamp: 2000 });
  await firePointer.up(popup, { ...touch, timeStamp: 2100 });
  popup.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
  await nextTick();
  expect(shown()).toBe(true);
});

// The fixed element of a modal popup and a backdrop take each pointer from the page.
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';
const BACKDROP = '[data-testid="backdrop"]';
const backdrop = { style: 'position: fixed; inset: 0' };
const covered: (Family & { surface: string })[] = [
  {
    name: 'Popover with modal true',
    fixture: PopoverParts,
    props: { root: { defaultOpen: true, modal: true } },
    popup: 'popup',
    surface: BLOCK,
  },
  {
    name: 'Popover with a backdrop',
    fixture: PopoverParts,
    props: { ...open, backdrop },
    popup: 'popup',
    surface: BACKDROP,
  },
  { name: 'Menu', fixture: MenuParts, props: open, popup: 'popup', surface: BLOCK },
  { name: 'Select', fixture: SelectParts, props: open, popup: 'popup', surface: BLOCK },
  {
    name: 'Combobox with modal true',
    fixture: ComboboxParts,
    props: { root: { defaultOpen: true, modal: true } },
    popup: 'popup',
    surface: BLOCK,
  },
  { name: 'Dialog', fixture: DialogParts, props: open, popup: 'popup', surface: BLOCK },
  {
    name: 'Dialog with modal false and a backdrop',
    fixture: DialogParts,
    props: { root: { defaultOpen: true, modal: false }, backdrop },
    popup: 'popup',
    surface: BACKDROP,
  },
];

test.each(covered)(
  '$name: a dispatched tap on the element that covers the page closes at its `pointerup` and cancels the `touchend` of the tap',
  async (family) => {
    const { shown } = await mountOpen(family);
    const surface = await waitFor(() => {
      const element = document.querySelector(family.surface);
      expect(element).not.toBe(null);
      return element!;
    });
    const touch = { pointerType: 'touch', isPrimary: true, clientX: 30, clientY: 30 };
    await firePointer.down(surface, { ...touch, timeStamp: 1000 });
    await firePointer.up(surface, { ...touch, timeStamp: 1100 });
    const end = new Event('touchend', { bubbles: true, cancelable: true });
    surface.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);
    await waitFor(() => expect(shown()).toBe(false));
  },
);

// The close takes the element away before the `click` of the tap (test/measurements/popup.test.ts).
test.skipIf(server.browser !== 'chromium').each(covered)(
  '$name: a real tap on the element that covers the page closes the popup, and the page under it gets no `click`',
  async (family) => {
    const { outside, shown } = await mountOpen(family);
    const clicks: string[] = [];
    outside.addEventListener('mousedown', () => clicks.push('mousedown'));
    outside.addEventListener('click', () => clicks.push('click'));
    const point = centerOf(outside);
    const surface = document.elementFromPoint(point.x, point.y);
    expect(surface?.matches(family.surface)).toBe(true);
    await touchDrag(point, point, 0);
    await waitFor(() => expect(shown()).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clicks).toEqual([]);
  },
);

// A mouse press on the element that covers the page closes these popups at `pointerdown`. After the
// close, the trigger has the focus.
const pressedCovers: (Omit<Family, 'popup'> & { cover: string; trigger: string })[] = [
  {
    name: 'Menu',
    fixture: MenuParts,
    props: {},
    cover: BLOCK,
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Select',
    fixture: SelectParts,
    props: {},
    cover: BLOCK,
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Combobox with modal true',
    fixture: ComboboxParts,
    props: { root: { modal: true } },
    cover: BLOCK,
    trigger: '[data-testid="input"]',
  },
  {
    name: "Popover with 'trap-focus' and a backdrop",
    fixture: PopoverParts,
    props: { root: { modal: 'trap-focus' }, close: {}, backdrop },
    cover: BACKDROP,
    trigger: '[data-key="t"]',
  },
  {
    name: "Dialog with 'trap-focus' and a viewport",
    fixture: DialogParts,
    props: { root: { modal: 'trap-focus' }, viewport: backdrop },
    cover: '[data-testid="viewport"]',
    trigger: '[data-key="t"]',
  },
  {
    name: "Drawer with 'trap-focus'",
    fixture: DrawerParts,
    props: { root: { modal: 'trap-focus' } },
    cover: '[data-testid="viewport"]',
    trigger: '[data-testid="trigger"]',
  },
];

test.each(pressedCovers)(
  '$name: a mouse press on the element that covers the page closes the popup, and the focus stays where the close puts it',
  async ({ fixture, props, cover, trigger }) => {
    mount(fixture, props);
    await nextTick();
    await userEvent.click(document.querySelector(trigger)!);
    const popup = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-testid="popup"]');
      expect(element?.checkVisibility()).toBe(true);
      return element!;
    });
    const point = { x: innerWidth - 10, y: 10 };
    await waitFor(() =>
      expect(document.elementFromPoint(point.x, point.y)?.matches(cover)).toBe(true),
    );
    await userEvent.pointer({ coords: point, keys: '[MouseLeft]' });
    await waitFor(() => expect(popup.checkVisibility()).toBe(false));
    expect(document.activeElement).toBe(document.querySelector(trigger));
  },
);

const scaled = [
  { name: 'Select', inner: 'select' },
  { name: 'Menu', inner: 'menu' },
  { name: 'Popover with modal true', inner: 'popover' },
  { name: 'Combobox with modal true', inner: 'combobox' },
] as const;

const SCALE = `:root { --z-backdrop: 60; --z-viewport: 70; --z-popup: 80 }
  [data-testid$="backdrop"] { z-index: var(--z-backdrop) }
  [data-testid$="viewport"] { z-index: var(--z-viewport) }
  [data-testid="positioner"] { z-index: var(--z-popup) }`;

function addStyleSheet(css: string) {
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = css;
  onTestFinished(() => style.remove());
}

async function openInDialog(
  inner: 'select' | 'menu' | 'popover' | 'combobox' | 'dialog',
  scale = true,
) {
  const log: string[] = [];
  if (scale) addStyleSheet(SCALE);
  mount(DialogWithInnerPopup, { inner, log: { add: (entry: string) => log.push(entry) } });
  const trigger = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="trigger"]');
    expect(element?.checkVisibility()).toBe(true);
    return element!;
  });
  await userEvent.click(trigger);
  const popup = () => document.querySelector('[data-testid="popup"]');
  await waitFor(() => expect(popup()?.checkVisibility()).toBe(true));
  log.length = 0;
  // The first fixed element is the one of the dialog.
  const block = await waitFor(() => {
    const blocks = document.querySelectorAll<HTMLElement>(BLOCK);
    expect(blocks).toHaveLength(2);
    return blocks[1];
  });
  const button = document.querySelector<HTMLElement>('[data-testid="button"]')!;
  return { log, trigger, block, button };
}

test.each(scaled)(
  '$name in a dialog on a z-index scale: the fixed element has the z-index of the positioner, covers the dialog and leaves the trigger free',
  async ({ inner }) => {
    const { trigger, block } = await openInDialog(inner);
    const positioner = document.querySelector('[data-testid="positioner"]')!;
    expect(getComputedStyle(positioner).zIndex).toBe('80');
    expect(getComputedStyle(block).zIndex).toBe('80');
    expect(document.elementFromPoint(2, 2)).toBe(block);
    const { x, y } = centerOf(trigger);
    await waitFor(() => expect(trigger.contains(document.elementFromPoint(x, y))).toBe(true));
  },
);

test.each(scaled)(
  '$name in a dialog on a z-index scale: a press at the corner of the page closes the popup and not the dialog, and a second press closes the dialog',
  async ({ inner }) => {
    const { log } = await openInDialog(inner);
    await userEvent.pointer({ coords: { x: 2, y: 2 }, keys: '[MouseLeft]' });
    expect(log).toEqual([`${inner} false outside-press`]);
    await userEvent.pointer({ coords: { x: 2, y: 2 }, keys: '[MouseLeft]' });
    await waitFor(() =>
      expect(log).toEqual([`${inner} false outside-press`, 'dialog false outside-press']),
    );
  },
);

test.each(scaled)(
  '$name in a dialog on a z-index scale: a press on a button of the dialog closes the popup, and the button gets no click',
  async ({ inner }) => {
    const { log, button } = await openInDialog(inner);
    await userEvent.pointer({ coords: centerOf(button), keys: '[MouseLeft]' });
    expect(log).toEqual([`${inner} false outside-press`]);
  },
);

test.each(scaled)(
  '$name in a dialog with no z-index: the fixed element has none',
  async ({ inner }) => {
    const { block } = await openInDialog(inner, false);
    expect(block.style.zIndex).toBe('');
    expect(getComputedStyle(block).zIndex).toBe('auto');
  },
);

// The positioner of a select stays in the DOM after a close. So only the new fixed element of the
// next open makes the portal read the z-index again.
test('Select in a dialog on a z-index scale: the next open takes the z-index that the positioner has then', async () => {
  const { block, trigger } = await openInDialog('select');
  const positioner = document.querySelector('[data-testid="positioner"]');
  expect(block.style.zIndex).toBe('80');
  await userEvent.pointer({ coords: { x: 2, y: 2 }, keys: '[MouseLeft]' });
  await waitFor(() => expect(block.isConnected).toBe(false));
  addStyleSheet(':root { --z-popup: 90 }');
  await userEvent.click(trigger);
  const next = await waitFor(() => {
    const blocks = document.querySelectorAll<HTMLElement>(BLOCK);
    expect(blocks).toHaveLength(2);
    return blocks[1];
  });
  expect(document.querySelector('[data-testid="positioner"]')).toBe(positioner);
  expect(next.style.zIndex).toBe('90');
});

test('a nested dialog on a z-index scale: a press at the corner of the page closes only that dialog, and its fixed element has no z-index', async () => {
  const { log, block } = await openInDialog('dialog');
  expect(block.style.zIndex).toBe('');
  expect(getComputedStyle(block).zIndex).toBe('auto');
  expect(document.elementFromPoint(2, 2)).toBe(block);
  await userEvent.pointer({ coords: { x: 2, y: 2 }, keys: '[MouseLeft]' });
  expect(log).toEqual(['nested false outside-press']);
});

async function mountPopovers(...ids: string[]) {
  for (const id of ids) {
    mount(PopoverParts, { root: { defaultOpen: true }, popup: { id } });
    await waitFor(() => expect(document.getElementById(id)).not.toBe(null));
  }
  return (id: string) => document.getElementById(id);
}

const touchAt = (element: Element) => {
  const { x, y } = centerOf(element);
  return { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
};

test('a touch that started before the popover opened again closes nothing at its end; a new tap closes it', async () => {
  const popup = await mountPopovers('popup');
  const trigger = document.querySelector<HTMLElement>('[data-key="t"]')!;
  const outside = document.getElementById('outside')!;
  const touch = touchAt(outside);
  await firePointer.down(outside, { ...touch, timeStamp: 1000 });
  trigger.click();
  await waitFor(() => expect(popup('popup')).toBe(null));
  trigger.click();
  await waitFor(() => expect(popup('popup')).not.toBe(null));
  await firePointer.up(outside, { ...touch, clientX: touch.clientX + 6, timeStamp: 1100 });
  await nextTick();
  expect(popup('popup')).not.toBe(null);
  await firePointer.down(outside, { ...touch, timeStamp: 2000 });
  await firePointer.up(outside, { ...touch, timeStamp: 2100 });
  await waitFor(() => expect(popup('popup')).toBe(null));
});

test('a touch that the browser cancels is no press: a click after it closes nothing', async () => {
  const popup = await mountPopovers('popup');
  const outside = document.getElementById('outside')!;
  const touch = touchAt(outside);
  await firePointer.down(outside, { ...touch, timeStamp: 1000 });
  await firePointer.cancel(outside, { ...touch, timeStamp: 1050 });
  outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  await nextTick();
  expect(popup('popup')).not.toBe(null);
});

test('a tap in a popover that opened later closes no popover that opened before it; a tap in the earlier one closes the later one', async () => {
  const popup = await mountPopovers('earlier', 'later');
  const tap = async (element: Element, time: number) => {
    const touch = touchAt(element);
    await firePointer.down(element, { ...touch, timeStamp: time });
    await firePointer.up(element, { ...touch, timeStamp: time + 50 });
  };
  await tap(popup('later')!, 1000);
  await nextTick();
  expect(popup('earlier')).not.toBe(null);
  expect(popup('later')).not.toBe(null);
  await tap(popup('earlier')!, 2000);
  await waitFor(() => expect(popup('later')).toBe(null));
  expect(popup('earlier')).not.toBe(null);
});

// A script that moves the focus out of a popup closes nothing. Tab closes the popup, a press outside
// closes it, and so does the focus that leaves a trigger, for each cause.
interface Holder extends Family {
  /** The trigger of the root. */
  trigger: string;
}

const holders: Holder[] = [
  {
    name: 'Popover',
    fixture: PopoverParts,
    props: open,
    popup: 'popup',
    trigger: '[data-key="t"]',
  },
  {
    name: 'Popover with modal true',
    fixture: PopoverParts,
    props: { root: { defaultOpen: true, modal: true }, close: {} },
    popup: 'popup',
    trigger: '[data-key="t"]',
  },
  {
    name: "Popover with modal 'trap-focus'",
    fixture: PopoverParts,
    props: { root: { defaultOpen: true, modal: 'trap-focus' }, close: {} },
    popup: 'popup',
    trigger: '[data-key="t"]',
  },
  {
    name: 'Dialog with modal false',
    fixture: DialogParts,
    props: { root: { defaultOpen: true, modal: false } },
    popup: 'popup',
    trigger: '[data-key="t"]',
  },
  {
    name: 'Drawer with modal false',
    fixture: DrawerParts,
    props: { root: { defaultOpen: true, modal: false } },
    popup: 'popup',
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Menu',
    fixture: MenuParts,
    props: open,
    popup: 'popup',
    trigger: '[data-testid="trigger"]',
  },
  {
    name: 'Select',
    fixture: SelectParts,
    props: open,
    popup: 'popup',
    trigger: '[data-testid="trigger"]',
  },
];

/**
 * Mounts the popup open, with a button in a live region outside it: a modal popup leaves a live
 * region in use, so its button takes a focus that a script moves. `stays` waits for the timers that
 * a close can use, and reads whether the popup is open.
 */
async function mountHolder(family: Family) {
  const live = document.body.appendChild(document.createElement('div'));
  live.setAttribute('aria-live', 'polite');
  const away = live.appendChild(document.createElement('button'));
  away.textContent = 'Live';
  onTestFinished(() => live.remove());
  const { shown } = await mountOpen(family);
  const popup = document.querySelector<HTMLElement>(`[data-testid="${family.popup}"]`)!;
  await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true));
  const inside = document.activeElement as HTMLElement;
  const stays = async () => {
    await nextTick();
    await wait(0);
    return shown();
  };
  return { live, away, inside, shown, stays };
}

test.each(holders)(
  '$name: a focus that a script moves out of the popup, with `focus`, with `focusVisible` or with `blur`, closes nothing',
  async (family) => {
    const { away, inside, stays } = await mountHolder(family);
    away.focus();
    expect(await stays()).toBe(true);
    expect(document.activeElement).toBe(away);
    inside.focus();
    away.focus({ focusVisible: true });
    expect(await stays()).toBe(true);
    inside.focus();
    inside.blur();
    expect(await stays()).toBe(true);
  },
);

test.each(holders)(
  '$name: a focus that a script moves out of the popup in a listener of `keydown` or `keyup` closes nothing',
  async (family) => {
    const { away, inside, stays } = await mountHolder(family);
    for (const type of ['keydown', 'keyup'] as const) {
      const controller = new AbortController();
      const { signal } = controller;
      // Firefox moves the focus out of the page for an F6 that no listener prevents.
      window.addEventListener('keydown', (event) => event.preventDefault(), { signal });
      window.addEventListener(type, () => away.focus(), { signal, once: true });
      await userEvent.keyboard('{F6}');
      controller.abort();
      expect(await stays()).toBe(true);
      expect(document.activeElement).toBe(away);
      inside.focus();
    }
  },
);

test.each(holders)(
  '$name: a focus that a script moves into a frame closes nothing, with the pointer away from the frame',
  async (family) => {
    const { live, inside, stays } = await mountHolder(family);
    // The pointer is not over the frame, which is at the right of the view.
    await userEvent.pointer({ coords: { x: 4, y: 4 } });
    const frame = live.appendChild(document.createElement('iframe'));
    frame.style.cssText = 'position: fixed; right: 0; bottom: 100px; width: 100px; height: 50px';
    frame.srcdoc = '<button>In</button>';
    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    frame.contentDocument!.querySelector('button')!.focus();
    expect(document.activeElement).toBe(frame);
    expect(await stays()).toBe(true);
    inside.focus();
    frame.focus();
    expect(await stays()).toBe(true);
  },
);

test.each(holders)(
  '$name: the focus that a script moves from the trigger to an outside element closes the popup',
  async (family) => {
    const { away, shown, stays } = await mountHolder(family);
    document.querySelector<HTMLElement>(family.trigger)!.focus();
    expect(await stays()).toBe(true);
    away.focus();
    await waitFor(() => expect(shown()).toBe(false));
  },
);

// A popup in place has no sentinel, so the order of the document moves the focus out of it.
async function mountInPlace() {
  mount(PopoverParts, { root: { defaultOpen: true }, portal: { disabled: true } });
  const popup = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="popup"]');
    expect(element?.checkVisibility()).toBe(true);
    return element!;
  });
  await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true));
  const [first, second] = popup.querySelectorAll('button') as unknown as [HTMLElement, HTMLElement];
  const after = document.getElementById('after')!;
  const shown = () => popup.isConnected && popup.checkVisibility();
  const stays = async () => {
    await nextTick();
    await wait(0);
    return shown();
  };
  return { first, second, after, shown, stays };
}

test('Tab from the last tab stop of a popup in place closes it, and the focus goes to the next element', async () => {
  const { second, after, shown } = await mountInPlace();
  second.focus();
  await userEvent.keyboard('{Tab}');
  expect(document.activeElement).toBe(after);
  await waitFor(() => expect(shown()).toBe(false));
});

test('Tab inside a popup in place closes nothing, and a script that moves the focus out of it later closes nothing', async () => {
  const { first, second, after, stays } = await mountInPlace();
  first.focus();
  await userEvent.keyboard('{Tab}');
  expect(document.activeElement).toBe(second);
  await wait(20);
  after.focus();
  expect(await stays()).toBe(true);
});

test('a Tab that a listener cancels closes nothing, and neither does a script that moves the focus in a timer after it', async () => {
  const { second, after, stays } = await mountInPlace();
  const controller = new AbortController();
  onTestFinished(() => controller.abort());
  // The listener of the window comes before that of the layer, so its timer runs before the timer of
  // the layer.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      setTimeout(() => after.focus());
    },
    { capture: true, signal: controller.signal },
  );
  second.focus();
  await userEvent.keyboard('{Tab}');
  await waitFor(() => expect(document.activeElement).toBe(after));
  expect(await stays()).toBe(true);
});

test('a Tab that a listener lets go on, after it moved the focus out of the popup in place, closes nothing', async () => {
  const { second, after, stays } = await mountInPlace();
  second.addEventListener('keydown', (event) => event.key === 'Tab' && after.focus(), {
    once: true,
  });
  second.focus();
  await userEvent.keyboard('{Tab}');
  expect(document.activeElement).not.toBe(second);
  expect(await stays()).toBe(true);
});

test('Tab from the last tab stop of a popup in place into a frame closes it', async () => {
  const { second, after, shown } = await mountInPlace();
  const outside = document.getElementById('outside')!;
  // The frame is the next tab stop.
  after.tabIndex = -1;
  outside.tabIndex = -1;
  const frame = document.body.appendChild(document.createElement('iframe'));
  onTestFinished(() => frame.remove());
  frame.srcdoc = '<button>In</button>';
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  second.focus();
  await userEvent.keyboard('{Tab}');
  await waitFor(() => expect(document.activeElement).toBe(frame));
  await waitFor(() => expect(shown()).toBe(false));
});

test('a focus that a script moves out of a popover in a popover closes neither', async () => {
  mount(PopoverParts, { root: { defaultOpen: true }, nested: {} });
  await waitFor(() => expect(document.querySelector('[data-testid="popup"]')).not.toBe(null));
  await userEvent.click(document.querySelector<HTMLElement>('[data-key="nested"]')!);
  const child = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="nested-popup"]');
    expect(element?.contains(document.activeElement)).toBe(true);
    return element!;
  });
  document.getElementById('after')!.focus();
  await nextTick();
  await wait(0);
  expect(child.isConnected).toBe(true);
  expect(document.querySelector('[data-testid="popup"]')).not.toBe(null);
});
