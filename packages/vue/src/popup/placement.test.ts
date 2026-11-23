import { expect, vi, describe, it } from 'vitest';
import { hide as nativeHide } from '@floating-ui/vue';
import type { MiddlewareState, Rect, SideObject } from '@floating-ui/vue';
import { nextTick } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { nextEvent } from '../../test/animation';
import PopupFirstPlace from '../../test/fixtures/PopupFirstPlace.vue';
import { mount } from '../../test/render';
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
});
