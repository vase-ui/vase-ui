import { computePosition, platform } from '@floating-ui/vue';
import type { Placement, Strategy } from '@floating-ui/vue';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { adaptiveOrigin } from './adaptiveOriginMiddleware';

const anchorBox = { left: 150, top: 150, width: 40, height: 20 };
const floatingSize = { width: 100, height: 50 };
const containerSize = { width: 300, height: 300 };

function createElement(style: Partial<CSSStyleDeclaration>, parent: Element = document.body) {
  const element = document.createElement('div');
  Object.assign(element.style, style);
  parent.append(element);
  onTestFinished(() => element.remove());
  return element;
}

function createParts(strategy: Strategy, options: { transition?: string; container?: boolean }) {
  const parent = options.container
    ? createElement({
        position: 'relative',
        width: `${containerSize.width}px`,
        height: `${containerSize.height}px`,
      })
    : document.body;
  const anchor = createElement(
    {
      position: strategy,
      left: `${anchorBox.left}px`,
      top: `${anchorBox.top}px`,
      width: `${anchorBox.width}px`,
      height: `${anchorBox.height}px`,
    },
    parent,
  );
  const floating = createElement(
    {
      position: strategy,
      width: `${floatingSize.width}px`,
      height: `${floatingSize.height}px`,
      transition: options.transition ?? '',
    },
    parent,
  );
  return { anchor, floating, parent };
}

// Puts the element at `x` and `y` from the edges that `sides` names. The other edges are `auto`.
function place(
  element: HTMLElement,
  sides: { sideX: 'left' | 'right'; sideY: 'top' | 'bottom' },
  x: number,
  y: number,
) {
  Object.assign(element.style, { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto' });
  element.style[sides.sideX] = `${x}px`;
  element.style[sides.sideY] = `${y}px`;
}

describe('adaptiveOrigin', () => {
  it('keeps the coordinates when the popup has no transition', async () => {
    const { anchor, floating } = createParts('fixed', {});
    const config = { strategy: 'fixed', placement: 'left' } as const;

    const plain = await computePosition(anchor, floating, config);
    const adaptive = await computePosition(anchor, floating, {
      ...config,
      middleware: [adaptiveOrigin],
    });

    expect(adaptive.middlewareData.adaptiveOrigin).toEqual({ sideX: 'left', sideY: 'top' });
    expect([adaptive.x, adaptive.y]).toEqual([plain.x, plain.y]);
  });

  // In these engines the visual viewport has the size of the document element. A fake visual
  // viewport of another size shows which of the two sizes the middleware reads. In WebKit,
  // Floating UI adds the offsets of the visual viewport to the rectangle of the anchor for the
  // fixed strategy. Without the offsets in the fake, each coordinate is NaN there, and the
  // fixed row fails.
  it.each([
    { name: 'the visual viewport for the fixed strategy', strategy: 'fixed', fromViewport: true },
    {
      name: 'the document element for the absolute strategy',
      strategy: 'absolute',
      fromViewport: false,
    },
  ] as const)('reads the size of $name', async ({ strategy, fromViewport }) => {
    const visualViewport = {
      width: 250,
      height: 350,
      offsetLeft: 0,
      offsetTop: 0,
    } as VisualViewport;
    const spy = vi.spyOn(window, 'visualViewport', 'get').mockReturnValue(visualViewport);
    onTestFinished(() => spy.mockRestore());
    const { anchor, floating } = createParts(strategy, { transition: 'transform 1s' });
    const adaptiveAt = (placement: Placement) =>
      computePosition(anchor, floating, { strategy, placement, middleware: [adaptiveOrigin] });

    const { x } = await adaptiveAt('left');
    const { y } = await adaptiveAt('top');

    // `x` is the distance from the left edge of the anchor to the right edge of the area that the
    // middleware reads. `y` is the distance from the top edge of the anchor to the bottom edge of
    // that area.
    const width = fromViewport ? visualViewport.width : document.documentElement.clientWidth;
    const height = fromViewport ? visualViewport.height : document.documentElement.clientHeight;
    expect(x).toBe(width - anchorBox.left);
    expect(y).toBe(height - anchorBox.top);
  });

  // The rectangle of the popup must be the same when it is placed from the left and top edges
  // and when it is placed from the edges that the middleware names.
  it.each([
    {
      name: 'the left side with the fixed strategy',
      placement: 'left',
      strategy: 'fixed',
      edge: 'right',
      container: false,
    },
    {
      name: 'the top side with the fixed strategy',
      placement: 'top',
      strategy: 'fixed',
      edge: 'bottom',
      container: false,
    },
    {
      name: 'the left side with the absolute strategy and the window as offset parent',
      placement: 'left',
      strategy: 'absolute',
      edge: 'right',
      container: false,
    },
    {
      name: 'the top side with the absolute strategy in a positioned container',
      placement: 'top',
      strategy: 'absolute',
      edge: 'bottom',
      container: true,
    },
  ] as const)(
    'gives the same place from the $edge edge for $name',
    async ({ placement, strategy, edge, container }) => {
      const { anchor, floating, parent } = createParts(strategy, {
        container,
        transition: 'transform 1s',
      });
      const config = { strategy, placement } as const;

      expect(await platform.getOffsetParent?.(floating)).toBe(container ? parent : window);

      const plain = await computePosition(anchor, floating, config);
      place(floating, { sideX: 'left', sideY: 'top' }, plain.x, plain.y);
      const expectedRect = floating.getBoundingClientRect().toJSON();

      const adaptive = await computePosition(anchor, floating, {
        ...config,
        middleware: [adaptiveOrigin],
      });
      const sides = adaptive.middlewareData.adaptiveOrigin;
      place(floating, sides, adaptive.x, adaptive.y);

      expect(sides).toEqual(
        edge === 'right' ? { sideX: 'right', sideY: 'top' } : { sideX: 'left', sideY: 'bottom' },
      );
      expect(floating.getBoundingClientRect().toJSON()).toEqual(expectedRect);
    },
  );
});
