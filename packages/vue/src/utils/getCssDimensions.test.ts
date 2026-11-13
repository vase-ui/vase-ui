import { expect, describe, it } from 'vitest';
import { isJSDOM } from '#test-utils';
import { getCssDimensions } from './getCssDimensions';

describe('getCssDimensions', () => {
  // A part with `as` or the `#render` slot can be an SVG element.
  // An SVG element has no `offsetWidth` or `offsetHeight`.
  it.skipIf(isJSDOM)('reads the CSS size of an SVG element', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '24');
    document.body.appendChild(svg);

    try {
      expect(getCssDimensions(svg)).toEqual({ width: 80, height: 24 });
    } finally {
      svg.remove();
    }
  });
});
