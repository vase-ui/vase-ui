import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CompositeItemAsyncSetup from './CompositeItemAsyncSetup.test.vue';
import CompositeItemTabStop from './CompositeItemTabStop.test.vue';

// The `tabindex` of the items a, b and c. The attribute order in the HTML is not part of the test.
function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) => {
    const tag = html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0];
    return tag?.match(/ tabindex="(-?\d+)"/)?.[1];
  });
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
  });
});
