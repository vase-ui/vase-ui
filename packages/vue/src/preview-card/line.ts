import { rectToClientRect } from '@floating-ui/utils';
import { isElement } from '@floating-ui/utils/dom';
import { inline, type Middleware } from '@floating-ui/vue';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A line of a link that wraps, by its index from the top. */
export interface Line {
  readonly trigger: Element;
  readonly index: number;
}

/**
 * The boxes of the lines of an element. Chromium and Firefox give more than one rectangle of
 * `getClientRects()` for one line (test/measurements/preview-card.test.ts). A rectangle starts a
 * new line when its top is below the top of the rectangle before it by more than half of that
 * height, as `inline()` of Floating UI groups them.
 */
export function linesOf(element: Element): Box[] {
  const boxes: Box[] = [];
  let previous: DOMRect | undefined;
  for (const rect of [...element.getClientRects()].sort((a, b) => a.top - b.top)) {
    const line = boxes.at(-1);
    if (!line || !previous || rect.top - previous.top > previous.height / 2) {
      boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    } else {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      line.bottom = Math.max(line.bottom, rect.bottom);
    }
    previous = rect;
  }
  return boxes;
}

const hoveredLines = new WeakMap<Element, number>();

/** Records the line of the link under the pointer. */
export function recordHoveredLine(event: PointerEvent) {
  const link = event.currentTarget as Element;
  const boxes = linesOf(link);
  // The point of a pointer event is in the box of its line
  // (test/measurements/preview-card.test.ts). A point between two lines takes the nearest one.
  const distances = boxes.map((box) =>
    Math.max(box.top - event.clientY, event.clientY - box.bottom, 0),
  );
  hoveredLines.set(link, distances.indexOf(Math.min(...distances)));
}

/** The line of the link that the pointer was on last. */
export function hoveredLineOf(link: Element): Line | null {
  const index = hoveredLines.get(link);
  return index === undefined ? null : { trigger: link, index };
}

const sideRectangle = inline();

/**
 * Gives the anchor the box of the line that the root holds, when that trigger is the anchor
 * element. `inline()` of Floating UI gives no line of a link whose lines overlap, also for a point
 * on that line (test/measurements/preview-card.test.ts). In each other case, the middleware gives
 * the result of `inline()`: the side rectangle of a link of more lines.
 */
export function lineMiddleware(line: () => Line | null): Middleware {
  return {
    name: 'inline',
    async fn(state) {
      const current = line();
      const { reference, floating } = state.elements;
      const element = isElement(reference) ? reference : reference.contextElement;
      const box =
        current && element === current.trigger ? linesOf(element)[current.index] : undefined;
      if (!box) return sideRectangle.fn(state);
      const rect = rectToClientRect({
        x: box.left,
        y: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      });
      const rects = await state.platform.getElementRects({
        reference: { getBoundingClientRect: () => rect },
        floating,
        strategy: state.strategy,
      });
      const before = state.rects.reference;
      const after = rects.reference;
      return after.x === before.x &&
        after.y === before.y &&
        after.width === before.width &&
        after.height === before.height
        ? {}
        : { reset: { rects } };
    },
  };
}
