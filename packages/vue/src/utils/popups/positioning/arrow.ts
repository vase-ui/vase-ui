import {
  clamp,
  evaluate,
  getAlignment,
  getAlignmentAxis,
  getAxisLength,
  getPaddingObject,
} from '@floating-ui/utils';
import type { Middleware, MiddlewareState, Padding } from '@floating-ui/vue';

// `@floating-ui/vue` does not export this type of `@floating-ui/dom`.
type Derivable<T> = (state: MiddlewareState) => T;

export interface ArrowOptions {
  /**
   * The arrow element to be positioned.
   * @default undefined
   */
  element: any;
  /**
   * The padding between the arrow element and the floating element edges.
   * Useful when the floating element has rounded corners.
   * @default 0
   */
  padding?: Padding | undefined;
}

/**
 * Fork of the `arrow` middleware of Floating UI. It always uses the floating element as the
 * offset parent of the arrow.
 * @see https://floating-ui.com/docs/arrow
 */
export const arrow = (options: ArrowOptions | Derivable<ArrowOptions>): Middleware => ({
  name: 'arrow',
  options,
  async fn(state) {
    const { x, y, placement, rects, platform, elements, middlewareData } = state;
    // `element` is required, so the type is not `Partial`.
    const { element, padding = 0 } = evaluate(options, state) || {};

    if (element == null) {
      return {};
    }

    const paddingObject = getPaddingObject(padding);
    const coords = { x, y };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform.getDimensions(element);
    const isYAxis = axis === 'y';
    const minProp = isYAxis ? 'top' : 'left';
    const maxProp = isYAxis ? 'bottom' : 'right';
    const clientProp = isYAxis ? 'clientHeight' : 'clientWidth';

    const endDiff =
      rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];

    const clientSize = elements.floating[clientProp] || rects.floating[length];

    const centerToReference = endDiff / 2 - startDiff / 2;

    // A large padding can move the arrow off the center. Then reduce the padding, so that the
    // arrow is at the center.
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = Math.min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = Math.min(paddingObject[maxProp], largestPossiblePadding);

    // Keep the arrow in the floating element when the center point is outside the bounds of the
    // floating element.
    const min = minPadding;
    const max = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset = clamp(min, center, max);

    // For an aligned placement, a small reference and the padding of the arrow can make the arrow
    // point to nothing. Then the middleware moves the floating element itself.
    // One reset makes sure that `shift()` still acts.
    const shouldAddOffset =
      !middlewareData.arrow &&
      getAlignment(placement) != null &&
      center !== offset &&
      rects.reference[length] / 2 -
        (center < min ? minPadding : maxPadding) -
        arrowDimensions[length] / 2 <
        0;
    const alignmentOffset = shouldAddOffset ? (center < min ? center - min : center - max) : 0;

    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset,
        centerOffset: center - offset - alignmentOffset,
        ...(shouldAddOffset && { alignmentOffset }),
      },
      reset: shouldAddOffset,
    };
  },
});
