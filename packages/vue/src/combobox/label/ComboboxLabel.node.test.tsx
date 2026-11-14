import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Combobox from '../index.parts';

// The opening tag of the element that has `attribute`.
function getTag(html: string, attribute: string) {
  return new RegExp(`<[^>]*${attribute}[^>]*>`).exec(html)?.[0];
}

describe('<Combobox.Label /> on a server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not run the development warning in production', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    expect(process.env.NODE_ENV).toBe('production');

    await renderToString(
      <Combobox.Root>
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.Input />
      </Combobox.Root>,
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('names the trigger that comes before it', async () => {
    const html = await renderToString(
      <Combobox.Root id="fruit">
        <Combobox.Trigger data-testid="trigger" />
        <Combobox.Label>Fruit</Combobox.Label>
      </Combobox.Root>,
    );

    expect(getTag(html, 'data-testid="trigger"')).toContain('aria-labelledby="fruit-label"');
    expect(getTag(html, 'id="fruit-label"')).toBeDefined();
  });
});
