import { round } from '@floating-ui/utils';
import type { Dimensions } from '@floating-ui/utils';
import { getComputedStyle, isHTMLElement } from '@floating-ui/utils/dom';

export function getCssDimensions(element: Element): Dimensions {
  const css = getComputedStyle(element);
  // The computed `width` and `height` of an SVG element can be empty strings.
  // `parseFloat` then gives `NaN`, so use `0`.
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;

  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }

  return {
    width,
    height,
  };
}
