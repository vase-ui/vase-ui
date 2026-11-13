import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CompositeItemAsyncSetup from './CompositeItemAsyncSetup.test.vue';
import CompositeItemNested from './CompositeItemNested.test.vue';
import CompositeItemTabStop from './CompositeItemTabStop.test.vue';

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, testId: string, name: string) {
  const tag = html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0];
  return tag?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function readTabindex(html: string, testId: string) {
  return readAttribute(html, testId, 'tabindex');
}

function readMarker(html: string, testId: string) {
  return readAttribute(html, testId, 'data-vase-ui-hydrating-composite-item');
}

// The `tabindex` of the items a, b and c.
function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) => readTabindex(html, testId));
}

describe('useCompositeItem', () => {
  describe('server-side rendering', () => {
    it('gives the tab stop to the active item', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<CompositeItemTabStop hasActiveItem active={['c']} />);

      expect(readTabindexes(html)).toEqual(['-1', '-1', '0']);
    });

    it('gives the tab stop to the first enabled item when no item is active', async () => {
      const html = await renderToString(<CompositeItemTabStop disabled={['a']} />);

      expect(readTabindexes(html)).toEqual(['-1', '0', '-1']);
    });

    it('gives the tab stop to the item at the highlighted index of a controlled root', async () => {
      const html = await renderToString(<CompositeItemTabStop highlightedIndex={2} />);

      expect(readTabindexes(html)).toEqual(['-1', '-1', '0']);
    });

    it('gives the tab stop to one item when two items are active', async () => {
      const html = await renderToString(<CompositeItemTabStop hasActiveItem active={['b', 'c']} />);

      expect(readTabindexes(html)).toEqual(['-1', '0', '-1']);
    });

    it('gives the tab stop to an active item below a component with an async setup', async () => {
      const html = await renderToString(<CompositeItemTabStop hasActiveItem active={['b']} late />);

      expect(readTabindexes(html)).toEqual(['-1', '0', '-1']);
    });

    it('gives the tab stop to one enabled item when the setup of an item runs late', async () => {
      const html = await renderToString(<CompositeItemAsyncSetup disabled={['a']} />);

      // The server runs the `setup` of b after the `setup` of c. The first enabled item of the
      // document is b. The server writes c with the tab stop before it reaches b.
      expect(readTabindexes(html)).toEqual(['-1', '-1', '0']);
    });

    it('marks each item with the id of its root', async () => {
      const html = await renderToString(<CompositeItemNested />);

      const first = readMarker(html, 'first');
      const nested = readMarker(html, 'b');

      // The ids come from Vue. The test compares them and does not write them.
      expect(first).toBeTruthy();
      expect(nested).toBeTruthy();
      expect(first).not.toBe(nested);
      expect(readMarker(html, 'last')).toBe(first);
      expect(readMarker(html, 'a')).toBe(nested);
      expect(readMarker(html, 'c')).toBe(nested);
      expect(readMarker(html, 'plain')).toBeUndefined();
      expect([readTabindex(html, 'first'), readTabindex(html, 'last')]).toEqual(['0', '-1']);
      expect(readTabindexes(html)).toEqual(['-1', '0', '-1']);
    });
  });
});
