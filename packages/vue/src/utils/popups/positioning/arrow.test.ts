import { arrow as nativeArrow, computePosition } from '@floating-ui/vue';
import { describe, expect, it, onTestFinished } from 'vitest';
import { arrow } from './arrow';

const anchorSize = { width: 40, height: 20 };
const floatingSize = { width: 200, height: 50 };
const arrowSize = 10;
const padding = 5;

function createElement(style: Partial<CSSStyleDeclaration>, parent: Element = document.body) {
  const element = document.createElement('div');
  Object.assign(element.style, style);
  parent.append(element);
  onTestFinished(() => element.remove());
  return element;
}

// The arrow is in the floating element, or in a wrapper of that element that has `wrapperWidth`.
function createParts(wrapperWidth?: number) {
  const anchor = createElement({
    position: 'fixed',
    left: '100px',
    top: '100px',
    width: `${anchorSize.width}px`,
    height: `${anchorSize.height}px`,
  });
  const floating = createElement({
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${floatingSize.width}px`,
    height: `${floatingSize.height}px`,
  });
  const arrowParent =
    wrapperWidth === undefined
      ? floating
      : createElement({ position: 'relative', width: `${wrapperWidth}px` }, floating);
  const element = createElement(
    { position: 'absolute', width: `${arrowSize}px`, height: `${arrowSize}px` },
    arrowParent,
  );
  return { anchor, floating, element };
}

describe('arrow', () => {
  it.each([
    {
      name: 'a placement that centers the floating element',
      placement: 'bottom',
      arrowX: floatingSize.width / 2 - arrowSize / 2,
    },
    {
      name: 'a placement that aligns the floating element to the start',
      placement: 'bottom-start',
      arrowX: anchorSize.width / 2 - arrowSize / 2,
    },
  ] as const)('centers the arrow on the anchor for $name', async ({ placement, arrowX }) => {
    const { anchor, floating, element } = createParts();

    const { middlewareData } = await computePosition(anchor, floating, {
      strategy: 'fixed',
      placement,
      middleware: [arrow({ element, padding })],
    });

    expect(middlewareData.arrow).toEqual({ x: arrowX, centerOffset: 0 });
  });

  it('uses the size of the floating element when the arrow has another offset parent', async () => {
    const wrapperWidth = 100;
    const { anchor, floating, element } = createParts(wrapperWidth);
    const config = { strategy: 'fixed', placement: 'bottom' } as const;

    const fork = await computePosition(anchor, floating, {
      ...config,
      middleware: [arrow({ element, padding })],
    });
    const native = await computePosition(anchor, floating, {
      ...config,
      middleware: [nativeArrow({ element, padding })],
    });

    expect(fork.middlewareData.arrow?.x).toBe(floatingSize.width / 2 - arrowSize / 2);
    expect(native.middlewareData.arrow?.x).toBe(wrapperWidth / 2 - arrowSize / 2);
  });
});
