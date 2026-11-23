import { describe, expect, inject, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { SelectRootOpenChangeEventDetails } from '@vase-ui/vue/select';
import SelectInPopover from '../../test/fixtures/SelectInPopover.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import SelectRenders from '../../test/fixtures/SelectRenders.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { clientCenter, touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';
import { scrollEdges } from './alignment';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const positioner = () => byTestId('positioner');
const item = (value: string) => byTestId(`item-${value}`);
const valueText = () => byTestId('value').textContent;
const shown = (element: HTMLElement | null) => !!element?.checkVisibility();
const many = (count: number, prefix = 'i') =>
  Array.from({ length: count }, (_, index) => ({
    value: `${prefix}${index}`,
    text: `Item ${prefix}${index}`,
  }));
/** A popup that covers the trigger: the trigger has the room for it above and below. */
const aligned = { positioner: {}, trigger: { style: 'margin-top: 200px' } };

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  await waitFor(() => expect(positioner().style.visibility).toBe(''));
}

async function closed() {
  await waitFor(() => expect(shown(popup())).toBe(false));
}

function centerOf(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
}

async function pressAndRelease(from: { x: number; y: number }, to: { x: number; y: number }) {
  await userEvent.pointer({ coords: from, keys: '[MouseLeft>]' });
  await userEvent.pointer({ coords: to });
  await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
}

function expectTextOverValue(edge: 'left' | 'right' = 'left', value = 'banana') {
  const box = byTestId('value').getBoundingClientRect();
  const text = item(value).firstElementChild!.getBoundingClientRect();
  expect(Math.abs(text.top + text.height / 2 - (box.top + box.height / 2))).toBeLessThan(1);
  expect(Math.abs(text[edge] - box[edge])).toBeLessThan(1);
}

async function popoverOpened() {
  await waitFor(() =>
    expect(byTestId('popover-popup')?.checkVisibility({ visibilityProperty: true })).toBe(true),
  );
}

describe('a select in a popover', () => {
  test('a pick in an aligned select keeps the popover, and one outside press then closes the popover', async () => {
    mount(SelectInPopover, {
      popover: { defaultOpen: true },
      positioner: { style: 'margin-top: 0' },
      root: { defaultValue: 'a' },
    });
    await popoverOpened();
    await pressAndRelease(centerOf(trigger()), centerOf(trigger()));
    await opened();
    await userEvent.click(item('b'));
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
    await pressAndRelease(centerOf(trigger()), centerOf(trigger()));
    await opened();
    await userEvent.click(item('a'));
    await closed();
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(byTestId('popover-popup')).toBe(null));
  });

  test('a pick in an aligned select that is not modal keeps a modal popover', async () => {
    mount(SelectInPopover, {
      popover: { defaultOpen: true, modal: true },
      positioner: {},
      root: { modal: false },
    });
    await popoverOpened();
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item('b'));
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
  });

  test('Escape in a select that is not modal closes only the select', async () => {
    mount(SelectInPopover, { popover: { defaultOpen: true }, root: { modal: false } });
    await popoverOpened();
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
  });

  test('a drag from the trigger of a modal select to a place outside both popups closes the select; the next outside press closes the popover', async () => {
    mount(SelectInPopover, { popover: { defaultOpen: true }, positioner: {} });
    await popoverOpened();
    await pressAndRelease(centerOf(trigger()), centerOf(document.getElementById('outside')!));
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(byTestId('popover-popup')).toBe(null));
  });
});

describe('the trigger', () => {
  test('a popup that does not cover the trigger stays open when the trigger gets the focus', async () => {
    const log: string[] = [];
    await mountSelect({
      root: { defaultOpen: true, onOpenChange: (open: boolean) => log.push(String(open)) },
    });
    await opened();
    trigger().focus();
    await wait(50);
    expect(shown(popup())).toBe(true);
    expect(log).toEqual([]);
  });

  test('after the release of the opening press, a press that starts in the popup and ends outside keeps it open', async () => {
    await mountSelect({ popup: { style: 'padding: 20px' } });
    await userEvent.click(trigger());
    await opened();
    const rect = popup().getBoundingClientRect();
    await pressAndRelease(
      { x: rect.left + 5, y: rect.top + 5 },
      centerOf(document.getElementById('outside')!),
    );
    await wait(50);
    expect(shown(popup())).toBe(true);
  });

  test('a release in a popup in a shadow root keeps the popup open', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadow = host.attachShadow({ mode: 'open' });
    try {
      await mountSelect({ portal: { to: shadow }, popup: { style: 'padding: 20px' } });
      await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
      const shadowPopup = () => shadow.querySelector<HTMLElement>('[data-testid="popup"]');
      await waitFor(() => expect(shadowPopup()?.checkVisibility()).toBe(true));
      const rect = shadowPopup()!.getBoundingClientRect();
      const inside = { x: rect.left + 5, y: rect.top + 5 };
      await userEvent.pointer({ coords: inside });
      await userEvent.pointer({ coords: inside, keys: '[/MouseLeft]' });
      await wait(50);
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    } finally {
      host.remove();
    }
  });
});

describe('the place of the popup', () => {
  test('the positioner rests at `sideOffset`, a number or a function of the sizes, and at `alignOffset`', async () => {
    const box = { style: 'width: 72px; height: 36px; box-sizing: border-box; margin: 0' };
    const popupBox = { style: 'width: 52px; height: 24px; overflow: hidden' };
    const place = reactive<Props>({ alignItemWithTrigger: false, sideOffset: 7 });
    await mountSelect({
      root: { defaultOpen: true },
      trigger: box,
      popup: popupBox,
      positioner: place,
    });
    await opened();
    const at = () => {
      const anchor = trigger().getBoundingClientRect();
      const rect = positioner().getBoundingClientRect();
      return { x: rect.left - anchor.left, y: rect.top - anchor.bottom };
    };
    // The popup is centered under the trigger: (72 - 52) / 2.
    expect(at()).toEqual({ x: 10, y: 7 });
    place.sideOffset = (data: { positioner: { width: number }; anchor: { width: number } }) =>
      data.positioner.width + data.anchor.width;
    await waitFor(() => expect(at()).toEqual({ x: 10, y: 124 }));
    place.sideOffset = 0;
    place.alignOffset = 5;
    await waitFor(() => expect(at()).toEqual({ x: 15, y: 0 }));
  });

  test('a popup with no room below flips to the top and rests at `collisionPadding` from the edge', async () => {
    await mountSelect({
      root: { defaultOpen: true },
      trigger: { style: 'position: fixed; bottom: 8px; left: 16px' },
      positioner: {
        alignItemWithTrigger: false,
        side: 'bottom',
        sideOffset: 8,
        collisionPadding: 12,
        collisionAvoidance: { fallbackAxisSide: 'none' },
      },
      popup: { style: 'width: 200px; height: 1000px; max-height: var(--available-height)' },
    });
    await opened();
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'top'));
    await waitFor(() => expect(Math.round(positioner().getBoundingClientRect().top)).toBe(12));
  });

  test('a popup that fits on no side above or below stays above or below', async () => {
    await mountSelect({
      root: { defaultOpen: true },
      trigger: { style: 'position: fixed; top: 45vh; left: 10px; height: 10vh' },
      positioner: { alignItemWithTrigger: false },
      popup: { style: 'height: 60vh; width: 50px' },
    });
    await opened();
    expect(positioner().getAttribute('data-side')).toMatch(/^(top|bottom)$/);
  });

  test('VUE-226: while the popup is aligned, `data-popup-side` of the trigger and `data-side` of the positioner are both none', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana' } });
    await userEvent.click(trigger());
    await opened();
    expect(positioner()).toHaveAttribute('data-side', 'none');
    expect(trigger()).toHaveAttribute('data-popup-side', 'none');
  });

  test('the measure of the alignment keeps the inline transforms of the popup', async () => {
    await mountSelect({
      ...aligned,
      root: { defaultValue: 'banana' },
      popup: { style: 'transform: translateX(10px); scale: 0.8; translate: 1px 2px' },
    });
    await userEvent.click(trigger());
    await opened();
    expect(positioner()).toHaveAttribute('data-side', 'none');
    expect(popup().style.transform).toBe('translateX(10px)');
    expect(popup().style.scale).toBe('0.8');
    expect(popup().style.translate).toBe('1px 2px');
  });

  test('puts the text over the value with a padding of the popup', async () => {
    await mountSelect({
      ...aligned,
      trigger: { style: 'margin: 200px 0 0 100px' },
      root: { defaultValue: 'banana' },
      popup: { style: 'padding: 12px 20px' },
    });
    await userEvent.click(trigger());
    await opened();
    expectTextOverValue();
  });

  test('a right-to-left select with no value puts the text of the first item over the placeholder at its inline end', async () => {
    await mountSelect({
      positioner: { dir: 'rtl' },
      root: { dir: 'rtl' },
      trigger: { style: 'margin-top: 200px; width: 160px', dir: 'rtl' },
      value: { placeholder: 'اختر' },
    });
    await userEvent.click(trigger());
    await opened();
    expect(positioner()).toHaveAttribute('data-side', 'none');
    const value = byTestId('value').getBoundingClientRect();
    const text = item('apple').firstElementChild!.getBoundingClientRect();
    expect(Math.abs(text.right - value.right)).toBeLessThan(1);
  });

  test('`--anchor-width` is the width of a custom anchor at the first aligned open', async () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    anchor.style.width = '240px';
    anchor.style.height = '20px';
    try {
      await mountSelect({ ...aligned, positioner: { anchor }, root: { defaultValue: 'banana' } });
      await userEvent.click(trigger());
      await opened();
      expect(positioner()).toHaveAttribute('data-side', 'none');
      await waitFor(() =>
        expect(positioner().style.getPropertyValue('--anchor-width')).toBe('240px'),
      );
    } finally {
      anchor.remove();
    }
  });

  test('a `max-height` of 0 is no limit: the aligned popup shows and grows with the scroll', async () => {
    await mountSelect({
      ...aligned,
      items: many(40),
      root: { defaultValue: 'i1' },
      trigger: { style: 'position: fixed; top: 400px; left: 20px' },
      popup: { style: 'max-height: 0px' },
    });
    await userEvent.click(trigger());
    await opened();
    const before = positioner().getBoundingClientRect().height;
    expect(before).toBeGreaterThan(40);
    popup().scrollTop = 40;
    await waitFor(() =>
      expect(positioner().getBoundingClientRect().height).toBeGreaterThan(before),
    );
  });

  test('a pinch zoom places the popup at the side of the trigger in WebKit only', async () => {
    const view = window.visualViewport!;
    Object.defineProperty(view, 'scale', { value: 1.5, configurable: true });
    try {
      await mountSelect({ ...aligned, root: { defaultValue: 'banana' } });
      await userEvent.click(trigger());
      await opened();
      await wait(20);
      expect(positioner()).toHaveAttribute(
        'data-side',
        server.browser === 'webkit' ? 'bottom' : 'none',
      );
    } finally {
      delete (view as { scale?: number }).scale;
    }
  });

  test('with Select.List, a scroll event of the popup changes no height; a scroll of the list grows the popup', async () => {
    await mountSelect({
      ...aligned,
      list: {},
      items: many(40),
      root: { defaultValue: 'i1' },
      trigger: { style: 'position: fixed; top: 400px; left: 20px' },
    });
    await userEvent.click(trigger());
    await opened();
    const before = positioner().getBoundingClientRect().height;
    popup().dispatchEvent(new Event('scroll'));
    await wait(30);
    expect(positioner().getBoundingClientRect().height).toBe(before);
    byTestId('list').scrollTop = 40;
    await waitFor(() =>
      expect(positioner().getBoundingClientRect().height).toBeGreaterThan(before),
    );
  });

  test('a scroll of the list of a closed popup changes no place and shows no arrow', async () => {
    await mountSelect({
      items: many(30),
      popup: { style: 'max-height: 120px; overflow-y: auto' },
      arrows: { keepMounted: true },
    });
    trigger().focus();
    await waitFor(() => expect(popup()).not.toBe(null));
    const style = positioner().getAttribute('style');
    popup().scrollTop = 40;
    popup().dispatchEvent(new Event('scroll'));
    await wait(30);
    expect(positioner().getAttribute('style')).toBe(style);
    expect(byTestId('up')).toHaveAttribute('hidden');
  });

  test('a hover of the items at the edges of an aligned popup moves neither the popup nor its list', async () => {
    await mountSelect({
      ...aligned,
      items: many(30),
      root: { defaultValue: 'i15' },
      popup: { style: 'max-height: 200px' },
    });
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(item('i15')));
    await wait(50);
    const geometry = () => ({
      top: positioner().getBoundingClientRect().top,
      height: positioner().getBoundingClientRect().height,
      scrollTop: popup().scrollTop,
    });
    const before = geometry();
    const options = [...popup().querySelectorAll<HTMLElement>('[role="option"]')];
    const box = popup().getBoundingClientRect();
    const edges = options.filter((option) => {
      const rect = option.getBoundingClientRect();
      return rect.top < box.top + 2 || rect.bottom > box.bottom - 2;
    });
    for (const option of edges.filter((option) => option.checkVisibility())) {
      const rect = option.getBoundingClientRect();
      const y = Math.min(Math.max(rect.top + 2, box.top + 2), box.bottom - 2);
      await userEvent.pointer({ coords: { x: rect.left + 10, y } });
    }
    await wait(50);
    expect(geometry()).toEqual(before);
  });

  test('the keys keep the highlighted item in view while the aligned popup grows', async () => {
    await mountSelect({
      ...aligned,
      items: many(30),
      root: { defaultValue: 'i1' },
      trigger: { style: 'position: fixed; top: 300px; left: 20px' },
      popup: { style: 'max-height: 400px' },
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(item('i1')));
    for (let step = 2; step <= 25; step += 1) {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).toBe(item(`i${step}`)));
      const box = popup().getBoundingClientRect();
      const rect = item(`i${step}`).getBoundingClientRect();
      expect(rect.top).toBeGreaterThanOrEqual(box.top - 1);
      expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 1);
    }
  });

  test('a reopen after new items and a value of null puts the list at its top', async () => {
    const items = reactive(many(40, 'a-'));
    const root = reactive<Props>({
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => (root.modelValue = value),
    });
    await mountSelect({
      ...aligned,
      items,
      root,
      trigger: { style: 'position: fixed; top: 300px; left: 20px; width: 160px' },
      popup: { style: 'min-height: 100px' },
    });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item('a-35'));
    await closed();
    items.splice(0, items.length, ...many(40, 'b-'));
    root.modelValue = null;
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(popup().scrollTop).toBe(0));
    const first = item('b-0').getBoundingClientRect();
    expect(first.top).toBeGreaterThanOrEqual(popup().getBoundingClientRect().top - 1);
  });
});

describe('the scroll arrows', () => {
  async function scrollableList(arrows: Props = {}) {
    await mountSelect({
      items: many(30),
      popup: { style: 'position: relative' },
      list: { style: 'max-height: 120px; overflow-y: auto' },
      arrows: { style: 'left: 0; right: 0; height: 16px', ...arrows },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(byTestId('down')).not.toBe(null));
  }

  function hoverAt(element: Element, type: 'pointerover' | 'pointermove', x: number, y: number) {
    element.dispatchEvent(
      new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }),
    );
  }

  test('a hover of the down arrow scrolls one step: the next item ends at the top of the arrow', async () => {
    await scrollableList();
    const arrow = byTestId('down');
    arrow.style.bottom = '0';
    const { x, y } = centerOf(arrow);
    hoverAt(arrow, 'pointerover', x, y - 1);
    hoverAt(arrow, 'pointermove', x, y);
    await waitFor(() => expect(byTestId('list').scrollTop).toBeGreaterThan(0));
    arrow.dispatchEvent(new PointerEvent('pointerleave'));
    const edge = arrow.getBoundingClientRect().top;
    const bottoms = [...popup().querySelectorAll('[role="option"]')].map(
      (option) => option.getBoundingClientRect().bottom,
    );
    expect(bottoms.some((bottom) => Math.abs(bottom - edge) < 1)).toBe(true);
  });

  test('a hover of the up arrow scrolls one step: the item before starts at the bottom of the arrow', async () => {
    await scrollableList();
    const list = byTestId('list');
    list.scrollTop = list.scrollHeight;
    await waitFor(() => expect(byTestId('up')).not.toBe(null));
    const arrow = byTestId('up');
    arrow.style.top = '0';
    const end = list.scrollTop;
    const { x, y } = centerOf(arrow);
    hoverAt(arrow, 'pointerover', x, y - 1);
    hoverAt(arrow, 'pointermove', x, y);
    await waitFor(() => expect(list.scrollTop).toBeLessThan(end));
    arrow.dispatchEvent(new PointerEvent('pointerleave'));
    expect(list.scrollTop).toBeGreaterThan(0);
    const edge = arrow.getBoundingClientRect().bottom;
    const tops = [...popup().querySelectorAll('[role="option"]')].map(
      (option) => option.getBoundingClientRect().top,
    );
    expect(tops.some((top) => Math.abs(top - edge) < 1)).toBe(true);
  });

  test('a move with no change of place does not scroll; a leave stops the scroll; a second move does not delay the step', async () => {
    await scrollableList();
    const arrow = byTestId('down');
    arrow.style.bottom = '0';
    const list = byTestId('list');
    const { x, y } = centerOf(arrow);
    hoverAt(arrow, 'pointerover', x, y);
    hoverAt(arrow, 'pointermove', x, y);
    await wait(120);
    expect(list.scrollTop).toBe(0);
    hoverAt(arrow, 'pointermove', x, y + 1);
    await wait(30);
    hoverAt(arrow, 'pointermove', x + 1, y + 1);
    await wait(20);
    expect(list.scrollTop).toBeGreaterThan(0);
    arrow.dispatchEvent(new PointerEvent('pointerleave'));
    const stopped = list.scrollTop;
    await wait(120);
    expect(list.scrollTop).toBe(stopped);
  });

  test('a kept arrow of a closed popup is hidden', async () => {
    await scrollableList({ keepMounted: true });
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('down')).toHaveAttribute('hidden');
    expect(byTestId('up')).toHaveAttribute('hidden');
  });

  test('the edges of the scroll take a distance of 1 px or less as none', () => {
    const edges = (scrollTop: number, scrollHeight = 100.5, clientHeight = 60) =>
      scrollEdges({ scrollTop, scrollHeight, clientHeight } as HTMLElement);
    expect(edges(0.4)).toEqual({ up: false, down: true });
    expect(edges(39.8)).toEqual({ up: true, down: false });
    expect(edges(20)).toEqual({ up: true, down: true });
  });
});

describe.skipIf(server.browser !== 'chromium')('a touch open', () => {
  async function tap(element: Element) {
    const point = centerOf(element);
    await touchDrag(point, point, 0);
  }

  test('places the popup at the side of the trigger, also with `alignItemWithTrigger`', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana' } });
    await tap(trigger());
    await opened();
    expect(positioner()).toHaveAttribute('data-side', 'bottom');
  });

  test('locks the scroll of a modal select only when the popup is as wide as the view', async () => {
    const narrow = await mountSelect({
      positioner: { alignItemWithTrigger: false, style: 'width: 240px' },
    });
    await tap(trigger());
    await opened();
    await wait(20);
    expect(isScrollLocked()).toBe(false);
    narrow.unmount();
    await mountSelect({
      positioner: { alignItemWithTrigger: false, style: 'width: calc(100vw - 10px)' },
    });
    await tap(trigger());
    await opened();
    await waitFor(() => expect(isScrollLocked()).toBe(true));
  });

  test('a quick touch reopen keeps the rules of a touch, and the selected item has the highlight', async () => {
    await mountSelect({
      ...aligned,
      root: { defaultValue: 'banana' },
      positioner: { style: 'width: 240px' },
    });
    await tap(trigger());
    await opened();
    await tap(document.getElementById('outside')!);
    await closed();
    await tap(trigger());
    await opened();
    await wait(20);
    expect(isScrollLocked()).toBe(false);
    expect(positioner()).toHaveAttribute('data-side', 'bottom');
    expect(item('banana')).toHaveAttribute('data-highlighted', '');
  });
});

describe.runIf(inject('app') === 'vdom')('the renders', () => {
  test('the keys that move the highlight render no trigger', async () => {
    const renders: Record<string, number> = {};
    const count = (part: string) => {
      renders[part] = (renders[part] ?? 0) + 1;
      return '';
    };
    mount(SelectRenders, { count });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await wait(50);
    for (const part of Object.keys(renders)) delete renders[part];
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Item 2'));
    expect(renders.trigger ?? 0).toBe(0);
    expect(renders.value ?? 0).toBe(0);
  });
});

describe('the work of an open', () => {
  test('an open over 300 items checks the visibility of the selected item only', async () => {
    await mountSelect({ items: many(300), root: { defaultValue: 'i150' } });
    const read = vi.spyOn(Element.prototype, 'checkVisibility');
    try {
      await userEvent.click(trigger());
      await waitFor(() => expect(document.activeElement).toBe(item('i150')));
      await nextTick();
      const options = read.mock.contexts.filter(
        (context) => context instanceof Element && context.matches('[role="option"]'),
      );
      expect(new Set(options)).toEqual(new Set([item('i150')]));
    } finally {
      read.mockRestore();
    }
  });
});

describe('the open state of the parent', () => {
  test('a close request while the parent holds `open` true emits each request', async () => {
    const log: string[] = [];
    await mountSelect({
      root: {
        open: true,
        modal: false,
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) =>
          log.push(`${open} ${details.reason}`),
      },
    });
    await opened();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(log).toContain('false outside-press'));
    expect(log[0]).toBe('false escape-key');
    expect(log.every((entry) => entry.startsWith('false '))).toBe(true);
    expect(shown(popup())).toBe(true);
    expect(valueText()).toBe('');
  });
});
