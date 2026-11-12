import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Button } from '@vase-ui/vue/button';

describe('<Button /> on a server', () => {
  it('renders a disabled button that stays focusable', async () => {
    const html = await renderToString(
      <Button disabled focusableWhenDisabled>
        Submit
      </Button>,
    );

    expect(html).toBe(
      '<button data-disabled type="button" tabindex="0" aria-disabled="true"><!--[-->Submit<!--]--></button>',
    );
  });
});
