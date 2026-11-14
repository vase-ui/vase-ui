import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Menu } from '@vase-ui/vue/menu';

describe('<Menu.Backdrop /> on a server', () => {
  it('writes the user select style with the prefix in its CSS form', async () => {
    const html = await renderToString(
      <Menu.Root open>
        <Menu.Backdrop />
      </Menu.Root>,
    );

    // A server writes the key `WebkitUserSelect` as `webkit-user-select`, which is not a CSS property.
    expect(html).toMatch(/style="user-select:none;-webkit-user-select:none;?"/);
    expect(html).toContain('role="presentation"');
  });
});
