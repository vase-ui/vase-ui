import { describe, expect, it } from 'vitest';
import { isVaporParts, withoutVaporAnchors } from '#test-utils';

describe('withoutVaporAnchors', () => {
  it('removes only the anchor nodes of Vapor parts, at each depth', () => {
    const element = document.createElement('div');
    element.innerHTML = '<!--if--><span data-value="one"><!--slot-->text <b> </b></span><!--for-->';
    element.prepend(document.createTextNode(''));
    element.querySelector('span')?.append(document.createTextNode(''));

    const result = withoutVaporAnchors(element);

    expect(result === element).toBe(!isVaporParts);
    expect(result.outerHTML).toBe(
      isVaporParts ? '<div><span data-value="one">text <b> </b></span></div>' : element.outerHTML,
    );
    expect(result.childNodes).toHaveLength(isVaporParts ? 1 : 4);
    expect(result.querySelector('span')?.childNodes).toHaveLength(isVaporParts ? 2 : 4);
    expect(element.childNodes).toHaveLength(4);
    expect(element.querySelector('span')?.childNodes).toHaveLength(4);
  });

  it('lets the empty element matcher ignore only Vapor anchors', () => {
    const element = document.createElement('div');
    element.append(document.createComment('if'), document.createTextNode(''));

    const result = withoutVaporAnchors(element);

    if (isVaporParts) {
      expect(result).toBeEmptyDOMElement();
    } else {
      expect(result).not.toBeEmptyDOMElement();
    }
    expect(element.childNodes).toHaveLength(2);
  });

  it('keeps white space and elements that make an element nonempty', () => {
    const element = document.createElement('div');
    element.innerHTML = '<!--if--> <span></span>';

    const result = withoutVaporAnchors(element);

    expect(result).not.toBeEmptyDOMElement();
    expect(result.textContent).toBe(' ');
    expect(result.querySelector('span')).not.toBe(null);
  });
});
