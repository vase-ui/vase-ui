import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CompositeListItemPart from '../../../../test/fixtures/CompositeListItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';

describe('useCompositeRoot', () => {
  describe('server-side rendering', () => {
    it('renders a root part with no attribute of the composite', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(
        <CompositeRoot>
          <CompositeListItemPart />
          <CompositeListItemPart />
        </CompositeRoot>,
      );

      expect(html).toBe(
        '<div data-highlighted-index="0"><!--[--><div data-index="0"><!--[--><!--]--></div><div data-index="1"><!--[--><!--]--></div><!--]--></div>',
      );
    });
  });
});
