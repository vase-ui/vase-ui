import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import SinglePart from './SinglePart.vue';

describe('SinglePart', () => {
  it('has no DOM in the node project', () => {
    expect(typeof document).toBe('undefined');
  });

  it('renders on a server', async () => {
    const html = await renderToString(<SinglePart orientation="vertical">text</SinglePart>);

    expect(html).toBe(
      '<div data-single-part data-orientation="vertical"><!--[-->text<!--]--></div>',
    );
  });
});
