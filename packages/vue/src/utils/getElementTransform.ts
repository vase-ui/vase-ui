import { ownerWindow } from '../common/owner';

/**
 * Gives the 2D translation and the scale from the computed `transform` matrix of the element.
 * The `translate`, `rotate` and `scale` longhands are separate properties. The computed `transform`
 * does not include them.
 *
 * Give `computedStyle` when the caller has it already, to avoid a second lookup.
 */
export function getElementTransform(element: HTMLElement, computedStyle?: CSSStyleDeclaration) {
  const transform = (computedStyle ?? ownerWindow(element).getComputedStyle(element)).transform;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;

  if (transform && transform !== 'none') {
    const matrix = /matrix(?:3d)?\(([^)]+)\)/.exec(transform);
    if (matrix) {
      /* eslint-disable @typescript-eslint/no-non-null-assertion -- The pattern has one group, and the length check of `values` proves each index. */
      const values = matrix[1]!.split(', ').map(parseFloat);
      if (values.length === 6) {
        translateX = values[4]!;
        translateY = values[5]!;
        scale = Math.sqrt(values[0]! * values[0]! + values[1]! * values[1]!);
      } else if (values.length === 16) {
        translateX = values[12]!;
        translateY = values[13]!;
        scale = values[0]!;
      }
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    }
  }

  return { x: translateX, y: translateY, scale };
}
