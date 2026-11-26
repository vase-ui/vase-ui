import { expect, vi, describe, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { hide as nativeHide } from '@floating-ui/vue';
import type { MiddlewareState, Rect, SideObject } from '@floating-ui/vue';
import { nextTick } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { addReducedMotionRule, nextEvent } from '../../test/animation';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PopoverPlaceWithFocus from '../../test/fixtures/PopoverPlaceWithFocus.vue';
import PopupFirstPlace from '../../test/fixtures/PopupFirstPlace.vue';
import type { PopupContentReading } from '../../test/fixtures/popupContent';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { hide } from './placement';

const floatingRect: Rect = { x: 0, y: 0, width: 5, height: 5 };

function createState(reference: Rect, overflow: SideObject): MiddlewareState {
  const referenceElement = document.createElement('button');
  const positionerElement = document.createElement('div');

  return {
    x: 0,
    y: 0,
    initialPlacement: 'bottom',
    placement: 'bottom',
    strategy: 'absolute',
    middlewareData: {},
    elements: {
      reference: referenceElement,
      floating: positionerElement,
    },
    rects: {
      reference,
      floating: floatingRect,
    },
    platform: {
      detectOverflow: vi.fn(() => Promise.resolve(overflow)),
      getElementRects: vi.fn(() => Promise.resolve({ reference, floating: floatingRect })),
      getClippingRect: vi.fn(() => Promise.resolve(reference)),
      getDimensions: vi.fn(() => Promise.resolve({ width: 5, height: 5 })),
    },
  };
}

describe('hide', () => {
  it.each([
    [{ top: 19, right: 9, bottom: 19, left: 9 }, false],
    [{ top: 20, right: 9, bottom: 19, left: 9 }, true],
    [{ top: 19, right: 10, bottom: 19, left: 9 }, true],
    [{ top: 19, right: 9, bottom: 20, left: 9 }, true],
    [{ top: 19, right: 9, bottom: 19, left: 10 }, true],
  ] satisfies [SideObject, boolean][])(
    'matches Floating UI hide() for reference overflow %#',
    async (overflow, expected) => {
      const state = createState({ x: 1, y: 2, width: 10, height: 20 }, overflow);

      const nativeResult = await nativeHide().fn(state);
      const result = await hide.fn(state);

      expect(result.data?.referenceHidden).toBe(nativeResult.data?.referenceHidden);
      expect(result.data?.referenceHidden).toBe(expected);
      expect(state.platform.detectOverflow).toHaveBeenCalledTimes(2);
      expect(state.platform.detectOverflow).toHaveBeenNthCalledWith(1, state, {
        elementContext: 'reference',
      });
      expect(state.platform.detectOverflow).toHaveBeenNthCalledWith(2, state, {
        elementContext: 'reference',
      });
    },
  );

  it('treats an all-zero reference rect as hidden', async () => {
    const state = createState(
      { x: 0, y: 0, width: 0, height: 0 },
      { top: -1, right: -1, bottom: -1, left: -1 },
    );

    const nativeResult = await nativeHide().fn(state);
    const result = await hide.fn(state);

    expect(nativeResult.data?.referenceHidden).toBe(false);
    expect(result.data?.referenceHidden).toBe(true);
  });
});

describe('the first place of an open', () => {
  const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const translateY = (element: Element) => new DOMMatrix(getComputedStyle(element).transform).f;

  it.each([
    { family: 'Popover', parts: Popover },
    { family: 'Menu', parts: Menu },
    { family: 'Tooltip', parts: Tooltip },
    { family: 'PreviewCard', parts: PreviewCard },
  ] as const)(
    '$family shows the positioner at its place and the popup at the `enter-from` of its side in the first frame',
    async ({ family, parts }) => {
      const handle = parts.createHandle();
      mount(PopupFirstPlace, { family, handle });
      await nextTick();
      handle.open('trigger');
      const firstFrame = await new Promise((resolve) =>
        requestAnimationFrame(() => {
          const positioner = byTestId('positioner');
          const popup = byTestId('popup');
          resolve({
            positioner: {
              transitions: positioner.getAnimations().length,
              rect: positioner.getBoundingClientRect().toJSON(),
            },
            popup: {
              side: popup.dataset.side,
              translateY: translateY(popup),
              animations: popup.getAnimations().map((animation) => animation.constructor.name),
            },
          });
        }),
      );
      // The enter goes from the `enter-from` of the side that the popup is on.
      const popup = byTestId('popup');
      await nextEvent(popup, 'transitionrun');
      expect(translateY(popup)).toBeGreaterThan(0);
      expect(firstFrame).toEqual({
        positioner: {
          transitions: 0,
          rect: byTestId('positioner').getBoundingClientRect().toJSON(),
        },
        popup: { side: 'top', translateY: 50, animations: ['CSSAnimation'] },
      });
    },
  );

  it('keeps a transition that started before the place, such as of a popup that loses `hidden`', async () => {
    const handle = Popover.createHandle();
    mount(PopupFirstPlace, { family: 'Popover', handle, keepMounted: true });
    // The browser computes the style of the closed popup.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    handle.open('trigger');
    const firstFrame = await new Promise((resolve) =>
      requestAnimationFrame(() => {
        const popup = byTestId('popup');
        resolve({
          positioner: byTestId('positioner').getAnimations().length,
          popup: {
            side: popup.dataset.side,
            transitions: popup
              .getAnimations()
              .map((animation) => (animation as CSSTransition).transitionProperty),
            opacity: Number(getComputedStyle(popup).opacity) < 0.5,
          },
        });
      }),
    );
    expect(firstFrame).toEqual({
      positioner: 0,
      popup: { side: 'top', transitions: ['opacity'], opacity: true },
    });
  });

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const centerX = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  };
  const placeTransitions = (element: Element) =>
    element.getAnimations().map((animation) => (animation as CSSTransition).transitionProperty);

  it('shows a kept popup at its trigger in the first frame of an open after a close at another trigger', async () => {
    const handle = Popover.createHandle();
    mount(PopupFirstPlace, { family: 'Popover', handle, keepMounted: true });
    await nextFrame();
    handle.open('trigger');
    await nextFrame();
    handle.close();
    await nextFrame();
    handle.open('second');
    const firstFrame = await new Promise((resolve) =>
      requestAnimationFrame(() => {
        const positioner = byTestId('positioner');
        const second = document.getElementById('second')!;
        resolve({
          transitions: placeTransitions(positioner),
          atTrigger: Math.abs(centerX(positioner) - centerX(second)) < 1,
        });
      }),
    );
    expect(firstFrame).toEqual({ transitions: [], atTrigger: true });
  });

  it('moves an open popup to another trigger with the transition of its place', async () => {
    const handle = Popover.createHandle();
    mount(PopupFirstPlace, { family: 'Popover', handle });
    await nextTick();
    handle.open('trigger');
    await nextFrame();
    handle.open('second');
    const firstFrame = await new Promise((resolve) =>
      requestAnimationFrame(() => {
        const positioner = byTestId('positioner');
        const second = document.getElementById('second')!;
        resolve({
          transitions: placeTransitions(positioner),
          atTrigger: Math.abs(centerX(positioner) - centerX(second)) < 1,
        });
      }),
    );
    expect(firstFrame).toEqual({ transitions: ['left'], atTrigger: false });
  });

  it.each([
    {
      family: 'Select, aligned with its trigger',
      fixture: SelectParts,
      props: {
        root: { defaultValue: 'banana' },
        positioner: {},
        trigger: { style: 'margin-top: 200px' },
      },
      trigger: '[data-testid="trigger"]',
    },
    { family: 'Menu', fixture: MenuParts, props: {}, trigger: '[data-testid="trigger"]' },
    {
      family: 'Combobox, its trigger the control',
      fixture: ComboboxStatic,
      props: { inputInPopup: true },
      trigger: '[data-testid="trigger"]',
    },
    { family: 'Popover', fixture: PopoverParts, props: {}, trigger: '[data-key="t"]' },
  ])(
    'with a transition of 0.01 ms on each element, a mouse press on the trigger opens $family, and the popup stays open with the focus',
    async ({ fixture, props, trigger }) => {
      addReducedMotionRule();
      mount(fixture, props);
      await nextTick();
      const element = document.querySelector<HTMLElement>(trigger)!;
      expect(document.activeElement).toBe(document.body);
      await userEvent.click(element);
      await waitFor(() =>
        expect(byTestId('popup')).toContainElement(document.activeElement as HTMLElement),
      );
      expect(element).toHaveAttribute('aria-expanded', 'true');
    },
  );

  it('places a disabled portal inside a positioned container on the first frame while letting content focus at mount', async () => {
    const handle = Popover.createHandle();
    const log: PopupContentReading[] = [];
    mount(PopoverPlaceWithFocus, {
      mode: 'relative',
      handle,
      log: { add: (entry: PopupContentReading) => log.push(entry) },
    });
    await nextTick();
    handle.open('trigger');
    const firstFrame = await new Promise<{
      topDiff: number;
      leftDiff: number;
      opacity: string;
    }>((resolve) =>
      requestAnimationFrame(() => {
        const trigger = byTestId('trigger').getBoundingClientRect();
        const pos = byTestId('positioner');
        const rect = pos.getBoundingClientRect();
        resolve({
          topDiff: Math.abs(rect.top - trigger.bottom),
          leftDiff: Math.abs(rect.left - trigger.left),
          opacity: pos.style.opacity,
        });
      }),
    );
    expect(log).toEqual([{ shown: true, sized: true, focused: true }]);
    expect(document.activeElement).toBe(byTestId('field'));
    expect(firstFrame.opacity).toBe('');
    expect(firstFrame.topDiff).toBeLessThan(1);
    expect(firstFrame.leftDiff).toBeLessThan(1);
  });

  it('keeps a scrolled page in place when content calls `focus()` at mount, and places the popup on the first frame', async () => {
    const handle = Popover.createHandle();
    const log: PopupContentReading[] = [];
    mount(PopoverPlaceWithFocus, {
      mode: 'scrolled',
      handle,
      log: { add: (entry: PopupContentReading) => log.push(entry) },
    });
    await nextTick();
    window.scrollTo(0, 1800);
    const before = window.scrollY;
    try {
      handle.open('trigger');
      const firstFrame = await new Promise<{
        topDiff: number;
        scrollY: number;
        opacity: string;
      }>((resolve) =>
        requestAnimationFrame(() => {
          const trigger = byTestId('trigger').getBoundingClientRect();
          const pos = byTestId('positioner');
          const rect = pos.getBoundingClientRect();
          resolve({
            topDiff: Math.abs(rect.top - trigger.bottom),
            scrollY: window.scrollY,
            opacity: pos.style.opacity,
          });
        }),
      );
      expect(log).toEqual([{ shown: true, sized: true, focused: true }]);
      expect(document.activeElement).toBe(byTestId('field'));
      expect(firstFrame.opacity).toBe('');
      expect(firstFrame.scrollY).toBe(before);
      expect(firstFrame.topDiff).toBeLessThan(1);
    } finally {
      window.scrollTo(0, 0);
    }
  });

  it('flips a popup whose height comes only from its content to the open side on the first frame with no transitions', async () => {
    const handle = Popover.createHandle();
    mount(PopoverPlaceWithFocus, { mode: 'content-sized', handle });
    await nextTick();
    handle.open('trigger');
    const firstFrame = await new Promise<{ side: string | null; transitions: number }>((resolve) =>
      requestAnimationFrame(() => {
        const pos = byTestId('positioner');
        resolve({ side: pos.getAttribute('data-side'), transitions: pos.getAnimations().length });
      }),
    );
    expect(firstFrame).toEqual({ side: 'top', transitions: 0 });
  });
});
