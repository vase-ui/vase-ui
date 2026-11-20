import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import CSPProviders from '../../test/fixtures/CSPProviders.vue';
import CSPStyleElements from '../../test/fixtures/CSPStyleElements.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { styleDisableScrollbar } from '../common/styles';

/** The text of each reader of the fixture, by its id. */
function readers(root: Element) {
  return Object.fromEntries(
    [...root.querySelectorAll('output')].map((output) => [output.id, output.textContent]),
  );
}

/** The style elements in the document that hide a native scrollbar. */
const disableScrollbarStyles = () =>
  [...document.querySelectorAll('style')].filter(
    (style) => style.textContent === styleDisableScrollbar.css,
  );

describe('the values of a part', () => {
  test('a part with no provider gets no values, and a part below a provider gets its nonce and disableStyleElements', async () => {
    const { root } = mount(CSPProviders, { outer: { nonce: 'abc', disableStyleElements: true } });
    await nextTick();
    expect(readers(root)).toEqual({ none: 'no provider', outer: 'abc true' });
  });

  test('a provider with no props gives no nonce and disableStyleElements false', async () => {
    const { root } = mount(CSPProviders);
    await nextTick();
    expect(readers(root)).toEqual({ none: 'no provider', outer: 'no nonce false' });
  });

  test('the nearest provider gives both values, and takes none from the provider around it', async () => {
    const { root } = mount(CSPProviders, {
      outer: { nonce: 'outer' },
      inner: { disableStyleElements: true },
    });
    await nextTick();
    expect(readers(root)).toEqual({
      none: 'no provider',
      outer: 'outer false',
      inner: 'no nonce true',
    });
  });

  test('a change of a prop reaches the parts, in the same elements', async () => {
    const outer = reactive<Record<string, unknown>>({ nonce: 'first' });
    const { root } = mount(CSPProviders, { outer });
    await nextTick();
    const before = root.querySelector('#outer');
    outer.nonce = 'second';
    outer.disableStyleElements = true;
    await nextTick();
    expect(root.querySelector('#outer')).toBe(before);
    expect(readers(root)).toEqual({ none: 'no provider', outer: 'second true' });
  });
});

describe('<CSPProvider />', () => {
  test('renders inline style tags by default', async () => {
    mount(CSPStyleElements, { part: 'scroll-area' });
    await nextTick();
    expect(disableScrollbarStyles()).toHaveLength(1);
    expect(disableScrollbarStyles()[0]).not.toHaveAttribute('nonce');
  });

  test('applies nonce to inline style tags', async () => {
    mount(CSPStyleElements, { part: 'scroll-area', csp: { nonce: 'test-nonce' } });
    await nextTick();
    expect(disableScrollbarStyles()).toHaveLength(1);
    expect(disableScrollbarStyles()[0]).toHaveAttribute('nonce', 'test-nonce');
  });

  test('does not render inline style tags when disableStyleElements is true', async () => {
    const { root } = mount(CSPStyleElements, {
      part: 'scroll-area',
      csp: { disableStyleElements: true },
    });
    await nextTick();
    expect(root.querySelector('.Viewport')).toHaveClass(styleDisableScrollbar.className);
    expect(disableScrollbarStyles()).toEqual([]);
  });

  test('does not render Select inline style tags when disableStyleElements is true', async () => {
    mount(CSPStyleElements, { part: 'select', csp: { disableStyleElements: true } });
    // The popup hides its scrollbar while it has a scroll arrow.
    await waitFor(() =>
      expect(document.querySelector('.Popup')).toHaveClass(styleDisableScrollbar.className),
    );
    await nextTick();
    expect(disableScrollbarStyles()).toEqual([]);
  });

  test('a select with a scroll arrow renders the style element with the nonce', async () => {
    mount(CSPStyleElements, { part: 'select', csp: { nonce: 'test-nonce' } });
    await waitFor(() =>
      expect(document.querySelector('.Popup')).toHaveClass(styleDisableScrollbar.className),
    );
    await nextTick();
    expect(disableScrollbarStyles()).toHaveLength(1);
    expect(disableScrollbarStyles()[0]).toHaveAttribute('nonce', 'test-nonce');
  });
});
