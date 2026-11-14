import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Drawer from '../index.parts';

describe('<Drawer.VirtualKeyboardProvider /> on a server', () => {
  it('renders its content and reads no window', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Drawer.Root defaultOpen>
            <Drawer.VirtualKeyboardProvider>
              <p>Form</p>
            </Drawer.VirtualKeyboardProvider>
          </Drawer.Root>
        ),
      }),
    );

    expect(html).toContain('<p>Form</p>');
  });
});
