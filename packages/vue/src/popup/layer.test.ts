import { expect, onTestFinished, test } from 'vitest';
import { server } from 'vitest/browser';
import { nextTick, type Component } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PreviewCardParts from '../../test/fixtures/PreviewCardParts.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import TooltipParts from '../../test/fixtures/TooltipParts.vue';
import { firePointer, sendTouch, stopFling, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
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
