import { getComputedStyle } from '@floating-ui/utils/dom';

export function getOffset(
  element: Element | null,
  prop: 'margin' | 'padding',
  axis: 'x' | 'y',
): number {
  if (!element) {
    return 0;
  }

  const styles = getComputedStyle(element);
  const key = `${prop}${axis === 'x' ? 'Inline' : 'Block'}` as const;
  const start = parseFloat(styles[`${key}Start`]);

  // Safari gives a wrong `marginInlineEnd` in RTL.
  // Assume that the start and the end margin are equal.
  if (axis === 'x' && prop === 'margin') {
    return start * 2;
  }

  return start + parseFloat(styles[`${key}End`]);
}
