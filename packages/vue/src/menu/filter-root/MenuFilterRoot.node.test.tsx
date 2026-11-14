import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Menu from '../index.parts';

describe('a filterable menu on a server', () => {
  it('renders the trigger of an open menu as the opener of a dialog', async () => {
    const html = await renderToString(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen defaultTriggerId="trigger">
          <Menu.Trigger id="trigger">Actions</Menu.Trigger>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="true"');
  });
});
