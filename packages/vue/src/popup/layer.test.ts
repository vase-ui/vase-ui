import { expect, onTestFinished, test } from 'vitest';
import { server } from 'vitest/browser';
import type { Component } from 'vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PreviewCardParts from '../../test/fixtures/PreviewCardParts.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import TooltipParts from '../../test/fixtures/TooltipParts.vue';
import { sendTouch, stopFling, touchDrag } from '../../test/pointer';
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
