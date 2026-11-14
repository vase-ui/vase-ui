import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Dialog from '../index.parts';

describe('<Dialog.Backdrop /> on a server', () => {
  it('renders the backdrop of an open dialog with its state and its style', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Dialog.Root defaultOpen>
            <Dialog.Backdrop data-testid="backdrop" />
          </Dialog.Root>
        ),
      }),
    );

    const backdrop = html.match(/<div [^>]*>/)?.[0];
    expect(backdrop).toContain('role="presentation"');
    expect(backdrop).toContain('data-open');
    expect(backdrop).not.toContain('hidden');
    expect(backdrop).toContain('style="user-select:none;-webkit-user-select:none;"');
  });

  it('renders no backdrop for a nested dialog unless forceRender is true', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Dialog.Root defaultOpen>
            <Dialog.Backdrop data-testid="root-backdrop" />
            <Dialog.Root defaultOpen>
              <Dialog.Backdrop data-testid="nested-backdrop" />
              <Dialog.Backdrop data-testid="forced-backdrop" forceRender />
            </Dialog.Root>
          </Dialog.Root>
        ),
      }),
    );

    expect(html).toContain('data-testid="root-backdrop"');
    expect(html).not.toContain('data-testid="nested-backdrop"');
    expect(html).toContain('data-testid="forced-backdrop"');
  });
});
