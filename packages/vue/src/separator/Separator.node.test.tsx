import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Separator } from '@vase-ui/vue/separator';

describe('<Separator /> on a server', () => {
  it('renders the role, the orientation and the content', async () => {
    const html = await renderToString(<Separator orientation="vertical">text</Separator>);

    expect(html).toBe(
      '<div data-orientation="vertical" role="separator" aria-orientation="vertical"><!--[-->text<!--]--></div>',
    );
  });
});
